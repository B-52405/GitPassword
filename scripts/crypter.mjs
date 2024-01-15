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
    encrypt,
    decrypt
}
