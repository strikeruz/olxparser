
# OLX parser
Parser olx data with nodeJS + pupitter

1. OLX parser data
2. OlX send parsed data to telegram channel
3. OLX save user phone number and auto add to telegram contact

# Settings

    const token = 'TELEGRAMM TOKEN';
    const bot = new TelegramBot(token);
    const chat_id = '@telegram_channel_code';
    const olxUri = `https://m.olx.ru`
    const olxParseUrl = `${olxUri}/simple/category/url`;

#	Methods

    phoneParser(pagenum, limit);
    sendToChannel(pageNum, limit);
    // Works with web.telegram.org
    addContact();
    parse();

# Install
1. Copy project from github
2. Install npm package  - npm install
3. run command node index.js
