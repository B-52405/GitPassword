const generate_random_password = (() => {
    const upper_case_chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const lower_case_chars = 'abcdefghijklmnopqrstuvwxyz'
    const number_chars = '0123456789'
    const symbol_chars = '!@#$%^&*()_-+=<>?/{}[]'

    const allChars = upper_case_chars + lower_case_chars + number_chars + symbol_chars
    const regex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[\W_])[A-Za-z\d\W_]+$/

    return (length) => {
        if (length < 4) {
            throw new Error('Length should be at least 4 to include all elements.');
        }

        let random_password = ""
        while (!regex.test(random_password)) {
            random_password = ""
            for (let i = 0; i < length; i++) {
                const randomIndex = Math.floor(Math.random() * allChars.length)
                random_password += allChars.charAt(randomIndex)
            }
        }
        return random_password
    }
})()

class Command {
    constructor(command) {
        const command_pieces = command.split(/\s+/).filter(Boolean);
        this.is_empty = command_pieces.length == 0
        if (this.is_empty) {
            return
        }
        this.command = command_pieces[0]
        this.param_count = command_pieces.length - 1
        this.params = command_pieces.slice(1)
    }
}

function encrypt(original_text, key) {
    return CryptoJS.AES.encrypt(JSON.stringify({ text: original_text }), key).toString()
}

function decrypt(encrypted_text, key) {
    try {
        const decrypted_text = CryptoJS.AES.decrypt(encrypted_text, key).toString(CryptoJS.enc.Utf8)
        const { text } = JSON.parse(decrypted_text)
        return {
            success: true,
            decrypted_text: text
        }
    } catch (error) {
        return {
            success: false,
            decrypted_text: undefined
        }
    }
}

export {
    generate_random_password,
    Command,
    encrypt,
    decrypt
}