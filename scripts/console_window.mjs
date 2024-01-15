import { createApp } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js'
import { Octokit } from 'https://esm.sh/octokit'
import { Command } from './command_parser.mjs'
import { encrypt, decrypt } from './crypter.mjs'

const banner = await fetch("./static/banner.json")
    .then(response => response.json())

createApp({
    data() {
        return {
            token: "",
            octokit: undefined,
            owner: "unknown",
            repo: "GitPasswordVault",
            path: "PasswordVault",
            sha: "",
            password_data: {},
            command: "",
            command_header: "",
            command_state: "",
            command_history: [],
            command_history_index: -1,
            command_lines: ["GitPassword:\\unknown> "],
            command_line_visibility: "hidden",
            log_lines: [],
            log_interval: 24,
            is_logging: false,
            code_completion_array: [],
            code_completion_index: -1,
            command_states: {
                LOGOUT: { 
                    id: "logout", 
                    handler: undefined,
                    visible: true,
                    record: true,
                },
                LOGIN: { 
                    id: "login", 
                    handler: undefined,
                    visible: true,
                    record: true
                },
                SET_MAIN_PASSWORD: { 
                    id:"set_main_password", 
                    handler: undefined,
                    header:"main password: ",
                    visible: false,
                    record: false
                }, 
                MAIN_PASSWORd: {
                    id: "main_password", 
                    handler: undefined,
                    header:"main password: ", 
                    visible: false,
                    record: false
                },
                TOKEN: { 
                    id: "token", 
                    handler: undefined,
                    header: "token: ",
                    visible: false,
                    record: false
                },
                NAME: { 
                    id: "name", 
                    handler: undefined,
                    header: "name: ",
                    visible: true,
                    record: false
                },
                USERNAME: { 
                    id: "username", 
                    handler: undefined,
                    header: "username: ",
                    visible: true,
                    record: false
                },
                PASSWORD: { 
                    id: "password", 
                    handler: undefined,
                    header: "password: ",
                    visible: false,
                    record: false
                }
            },
            commands: {
                INIT: "init",
                HELP: "help",
                LOGIN: "login",
                EXIT: "exit",
                ADD: "add",
                ALL: "all",
                DELETE: "delete",
                SEARCH: "search"
            },
            new_password: {
                name: undefined,
                username: undefined,
                password: undefined
            },
        }
    },
    methods: {
        async handle_key_down(event) {
            this.command_line_focus()

            if (event.ctrlKey && (event.key === 'c' || event.key === 'C')) {
                this.command_state = this.octokit ? this.command_states.LOGIN : this.command_states.LOGOUT
                this.console_log(
                    this.banner_yielder(this.command_lines.concat([" ", "    Control-C", " "]), false))
            }
            else if (event.key == "ArrowUp") {
                if(!this.command_state.record){
                    return
                }
                if (this.command_history_index < this.command_history.length - 1) {
                    this.command_history_index++
                    this.set_command(this.command_history[this.command_history_index])
                }
            }
            else if (event.key == "ArrowDown") {
                if(!this.command_state.record){
                    return
                }
                if (this.command_history_index > 0) {
                    this.command_history_index--
                    this.set_command(this.command_history[this.command_history_index])
                }
            }           
            if(event.key == "Tab"){
                event.preventDefault();
                if(!this.command_state.record){
                    return
                }
                if(this.code_completion_index < 0){
                    for(let id in this.commands){
                        if(this.commands[id].startsWith(this.command.toLowerCase())){
                            this.code_completion_array.push(this.commands[id])
                        }
                    }
                }
                this.code_completion_index = (this.code_completion_index+1)%this.code_completion_array.length
                this.set_command(this.code_completion_array[this.code_completion_index])
            }
            else{
                this.code_completion_array = []
                this.code_completion_index = -1
            }

            if (event.key !== 'Enter') {
                return
            }
            this.log_lines = this.log_lines.concat(this.command_lines)
            if(this.command_state.record){
                this.command_history.unshift(this.command)
                this.command_history_index = -1;
            }
            const command = new Command(this.command)
            if (command.is_empty) {
                this.command = ""
                this.scroll_to_bottom()
                return
            }
            this.command_state.handler(command)
            this.command = ""
            this.scroll_to_bottom()
        },
        async *banner_yielder(banner, blank_row = true) {
            if (blank_row) {
                yield " "
            }
            for (let line of banner) {
                yield line
            }
            if (blank_row) {
                yield " "
            }
        },
        console_log(log_lines) {
            this.is_logging = true
            this.command_line_visibility = "hidden"
            let next_line = log_lines.next()

            const log = async () => {
                const { value: line, done: done } = await next_line
                next_line = log_lines.next()
                if (done) {
                    this.is_logging = false
                    this.command_line_visibility = "visible"
                    this.scroll_to_bottom()
                    return
                }
                this.log_lines.push(line)
                setTimeout(log, this.log_interval)
            }
            log()
        },
        scroll_to_bottom() {
            this.$nextTick(() => {
                this.$refs.console_window.scrollTop = this.$refs.console_window.scrollHeight;
                this.command_line_focus()
            });
        },
        get_command_line_style() {
            return {
                visibility: this.command_line_visibility
            }
        },
        date_formatter() {
            return new Date().toLocaleString()
        },
        command_line_focus() {
            const command_line = this.$refs.command_line
            const length = command_line.value.length
            command_line.focus()
            command_line.setSelectionRange(length,length)
        },
        set_command(command){
            this.command = command
            this.$nextTick(()=>this.command_line_focus)
        },
        measure_string_width(str) {
            this.$refs.text_measure.textContent = str
            return this.$refs.text_measure.offsetWidth
        },
        generate_command_lines() {
            const console_window = this.$refs.console_window
            if (console_window == undefined) {
                return
            }
            let command_with_header = ""
            if(this.command_state.visible){
                command_with_header = this.command_header + this.command
            }
            else{
                command_with_header = this.command_header + "*".repeat(this.command.length)
            }
            this.command_lines = []
            let line_index = 0
            let width = 0
            for (let i in command_with_header) {
                const char_width = this.measure_string_width(command_with_header[i])
                width += char_width
                if (width > console_window.offsetWidth) {
                    this.command_lines.push(command_with_header.slice(line_index, i))
                    line_index = i
                    width = 0
                }
            }
            this.command_lines.push(command_with_header.slice(line_index))
        },
        copy(data) {
            const clipboard = new ClipboardJS('#copy_button', {
                text: () => data
            });
            clipboard.on('success', (e) => {
                clipboard.destroy();
            });
            clipboard.on('error', (e) => {
                clipboard.destroy();
            });
            document.querySelector('#copy_button').click();
        },

        //state handler
        state_logout_handler(command) {
            if (this.command_equals(command.command, this.commands.HELP)) {
                this.console_log(this.banner_yielder(banner["help"]))
            }
            else if (this.command_equals(command.command, this.commands.INIT)){
                this.console_log(this.banner_yielder([" "], false))
                this.command_state = this.command_states.TOKEN
            }
            else if (this.command_equals(command.command, this.commands.LOGIN)) {
                this.console_log(this.banner_yielder([" "], false))
                this.command_state = this.command_states.MAIN_PASSWORd
            }
            else {
                this.console_log(this.banner_yielder(banner["warning"]))
            }
        },
        state_token_handler(command) {
            if (!this.assert_param_count(command.param_count, 0)) {
                return
            }
            else {
                this.token = command.command
                this.octokit = new Octokit({ auth: this.token })
                this.console_log((async function* (app) {
                    yield " "
                    yield "    Authenticating ..."
                    try{
                        const login_response = await app.octokit.rest.users.getAuthenticated()
                        app.owner = login_response.data.login
                    }catch(error){
                        app.token = ""
                        app.octokit = undefined
                        yield "    Token incorrect."
                        yield " "
                        return
                    }                   
                    yield "    Authentication succeeded."
                    yield "    Creating repository ..."
                    try{
                        await app.octokit.rest.repos.createForAuthenticatedUser({
                            name: "GitPasswordVault",
                            description: 'A vault of passwords by GitPassword',
                            private: true
                        })
                        await app.octokit.rest.repos.createOrUpdateFileContents({
                            owner: app.owner,
                            repo: app.repo,
                            path: app.path,
                            message: "Create PasswordVault",
                            content: btoa(encrypt("{}",app.token)),
                        })
                        await app.octokit.rest.repos.createOrUpdateFileContents({
                            owner: app.owner,
                            repo: app.repo,
                            path: "README.md",
                            message: "Create README.md",
                            content: btoa(await fetch("./static/README.md")
                                .then(response => response.text()))
                        })
                    }catch(error){
                        yield "    Repository already exists."
                        yield "    Checking data ..."
                        const data_response = await app.octokit.rest.repos.getContent({
                            owner: app.owner,
                            repo: app.repo,
                            path: app.path
                        })
                        const {success, decrypted_text} = decrypt(atob(data_response.data.content), app.token)
                        if(!success){
                            app.token = ""
                            app.owner = "unknown"
                            app.octokit = undefined
                            yield "    Error: Data corruption."
                            yield "    Please delete PasswordVault and reinitialize."
                            yield " "
                            return
                        }
                    }
                    app.command_state = app.command_states.SET_MAIN_PASSWORD
                    yield `    Initialize done. Now please setup your main password.`
                    yield " "
                })(this))
            }
        },
        state_set_main_password_handler(command){
            if (!this.assert_param_count(command.param_count, 0)) {
                return
            }
            const userinfo = {
                token: this.token
            }
            const encrypted_userinfo = encrypt(JSON.stringify(userinfo), command.command)
            Cookies.set("userinfo", encrypted_userinfo, { expires: Infinity })
            this.token = ""
            this.owner = "unknown"
            this.octokit = undefined

            this.console_log(this.banner_yielder(banner["init_done"]))
            this.command_state = this.command_states.LOGOUT
        },
        state_main_password_handler(command){
            if (!this.assert_param_count(command.param_count, 0)) {
                return
            }
            const { success, decrypted_text } = decrypt(Cookies.get("userinfo"),command.command)
            if(!success){
                this.console_log(this.banner_yielder(banner["warning_main_password_incorrect"]))
                this.command_state = this.command_states.LOGOUT
                return
            }
            const userinfo = JSON.parse(decrypted_text)
            this.token = userinfo.token
            this.octokit = new Octokit({ auth: this.token })
            this.console_log((async function* (app) {
                yield " "
                yield "    Logging in ..."
                const login_response = await app.octokit.rest.users.getAuthenticated()
                app.owner = login_response.data.login
                yield "    Authentication succeeded."
                yield "    Loading data ..."
                const data_response = await app.octokit.rest.repos.getContent({
                    owner: app.owner,
                    repo: app.repo,
                    path: app.path
                })
                const {success, decrypted_text} = decrypt(atob(data_response.data.content), app.token)
                if(!success){
                    yield "    Error: Data corruption."
                    yield "    Please reinitialize, all data will NOT be retained."
                    yield " "
                    app.owner = "unknown"
                    return
                }
                app.command_state = app.command_states.LOGIN
                app.password_data = decrypted_text == "" ? {} : JSON.parse(decrypted_text)
                app.sha = data_response.headers.etag.slice(3, -1)
                yield `    Welcome, ${app.owner}.`
                yield " "
            })(this))
        },
        state_login_handler(command) {
            if (this.command_equals(command.command, this.commands.HELP)) {
                this.console_log(this.banner_yielder(banner["help"]))
            }
            else if (this.command_equals(command.command, this.commands.EXIT)) {
                location.reload()
            }
            else if (this.command_equals(command.command, this.commands.ALL)) {
                this.console_log(this.banner_yielder(this.search_password(() => true)), false)
            }
            else if (this.command_equals(command.command, this.commands.SEARCH)) {
                if (!this.assert_param_count(command.param_count, 1)) {
                    return
                }
                this.console_log(this.banner_yielder(this.search_password((password) => {
                    return password.name.toLowerCase().includes(command.params[0].toLowerCase())
                })))
            }
            else if (this.command_equals(command.command, this.commands.ADD)) {
                if (!this.assert_param_count(command.param_count, 0)) {
                    return
                }
                this.console_log(this.banner_yielder([" "], false))
                this.command_state = this.command_states.NAME
            } else if (this.command_equals(command.command, this.commands.DELETE)) {
                if (!this.assert_param_count(command.param_count, 1)) {
                    return
                }
                const name = command.params[0]
                if (!(name in this.password_data)) {
                    this.console_log(this.banner_yielder(banner["warning_no_such_password"]))
                    return
                }
                delete this.password_data[name]
                this.update_remote_repo()
            }
            else {
                this.console_log(this.banner_yielder(banner["warning"]))
            }
        },
        state_name_handler(command) {
            if (!this.assert_param_count(command.param_count, 0)) {
                return
            }
            this.new_password.name = command.command
            this.command_state = this.command_states.USERNAME
        },
        state_username_handler(command) {
            if (!this.assert_param_count(command.param_count, 0)) {
                return
            }
            this.new_password.username = command.command
            this.command_state = this.command_states.PASSWORD
        },
        state_password_handler(command) {
            if (!this.assert_param_count(command.param_count, 0)) {
                return
            }
            this.new_password.password = command.command
            this.password_data[this.new_password.name] = [this.new_password.username, this.new_password.password]
            this.update_remote_repo()
            this.command_state = this.command_states.LOGIN
        },

        assert_param_count(param_count, number) {
            if (param_count != number) {
                this.console_log(this.banner_yielder(banner["warning_incorrect_parameter_number"]))
                return false
            }
            return true
        },
        command_equals(command, COMMAND) {
            return command.toLowerCase() == COMMAND
        },
        update_remote_repo() {
            this.console_log((async function* (app) {
                yield " "
                yield "    Updating remote repository ..."
                await app.octokit.rest.repos.createOrUpdateFileContents({
                    owner: app.owner,
                    repo: app.repo,
                    path: app.path,
                    message: "Update PasswordVault",
                    content: btoa(encrypt(JSON.stringify(app.password_data), app.token)),
                    sha: app.sha,
                })
                yield "    Snycing hash value ..."
                const data_response = await app.octokit.rest.repos.getContent({
                    owner: app.owner,
                    repo: app.repo,
                    path: app.path
                })
                app.sha = data_response.headers.etag.slice(1, -1)
                yield "    Done."
                yield " "
            })(this))
        },
        search_password(filter) {
            const passwords = []
            for (let name in this.password_data) {
                const password = {
                    name: name,
                    username: this.password_data[name][0],
                    password: this.password_data[name][1],
                    hidden_password: "********"
                }
                if (filter(password)) {
                    passwords.push(password)
                }
            }
            if(passwords.length == 0){
                return ["    No records."]
            }
            return passwords
        }

        //test
    },
    computed: {

    },
    watch: {
        command(command, old_command) {
            this.generate_command_lines()
        },
        command_state(state, old_state) {
            if (state == this.command_states.LOGOUT ||
                state == this.command_states.LOGIN) {
                this.command_header = `GitPassword:\\${this.owner}> `
            }
            else {
                this.command_header = state.header
            }
            this.generate_command_lines()
        }
    },
    mounted() {
        document.addEventListener('keydown', this.handle_key_down)
        window.addEventListener("focus", this.command_line_focus)
        window.addEventListener("resize", this.generate_command_lines)

        for (let state in this.command_states) {
            this.command_states[state].handler = this[`state_${this.command_states[state].id}_handler`]
        }

        this.$refs.console_window.style.visibility = "visible"
        this.console_log(this.banner_yielder(banner["banner"], false))
        this.command_state = this.command_states.LOGOUT
        this.command_line_focus()

        //test
        window.data = this
    }
}).mount("#app")