class Command{
    constructor(command){
        const command_pieces = command.split(/\s+/).filter(Boolean);
        this.is_empty = command_pieces.length == 0
        if(this.is_empty){
            return
        }
        this.command = command_pieces[0]
        this.param_count = command_pieces.length - 1
        this.params = command_pieces.slice(1)
    }
}

export{
    Command
}