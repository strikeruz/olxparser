const puppeteer = require('puppeteer');
const axios  = require('axios')
const fs = require('fs');

/* Telegramm Settings */
const TelegramBot = require('node-telegram-bot-api');
const token = 'TELEGRAMM TOKEN';
const bot = new TelegramBot(token);
const chat_id = '@telegram_channel_code';
const olxUri = `https://m.olx.ru`
const olxParseUrl = `${olxUri}/simple/category/url`;


const browserParams =
{
    headless: false,
    ignoreHTTPSErrors: true,
    args: [
        '--window-size=414, 736',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--ignore-certifcate-errors',
        '--ignore-certifcate-errors-spki-list',
        '--user-agent="Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.109 Mobile Safari/537.3"'
    ]
}

const parse = async (pagenum, limit) => {
    const url = `${olxParseUrl}/?page=${pagenum}`;
    const browser = await puppeteer.launch(browserParams);
    const page = await browser.newPage();
    // await page.setUserAgent('Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.109 Mobile Safari/537.3');
    await page.goto(url, {
        waitUntil: 'networkidle2',
    })

    const result = await page.evaluate((limit) => {
        let links = []
        document.querySelectorAll('[data-cy="l-card"]').forEach((data, index) => {
            let linkUrl = olxUri + data.querySelector('a').getAttribute('href').replace('?reason=', '');
            if (limit) {
                if (index < limit) {
                    links.push(linkUrl)
                };
            } else {
                links.push(linkUrl)
            }
        })
        return links;
    }, limit);
    await browser.close();

    return result;
}


const detailParse  = async (url) => {
    const browser = await puppeteer.launch(browserParams);
    const page = await browser.newPage();
    // await page.setUserAgent('Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.109 Mobile Safari/537.3');
    const response = await page.goto(url, {
       waitUntil: 'networkidle2',
       timeout: 0
    })

    if(response._status === 200) {
        // Token
        const cookies = await page.cookies()
        const activeCookie = cookies.filter(item => item.name == 'a_access_token');
        const activeCookieVal = activeCookie[0].value || null
        const store = (await page.$x('//*[@id="root"]/div[1]/div/div/main/section[7]/span[1]'))[0]

        await page.evaluate(_ => {
            window.scrollTo({top:300})
        });
        const btnPhone = await page.$x('//*[@id="root"]/div[1]/div/div/main/section[9]/div/button[1]')
        page.click(btnPhone)
        const phoneEl = await page.$x('//*[@id="root-portal"]/div[2]/div[1]/p/a')

        const result = await page.evaluate((store, cookie) => {
            const x = (xpath) => {
                return document.evaluate(
                    xpath,
                    document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
            }

            if(store && cookie) {
                const id = store.innerText.split(':')[1].trim()

                let title = x('//*[@id="root"]/div[1]/div/div/main/section[3]/p').innerText;
                let content = x('//*[@id="root"]/div[1]/div/div/main/section[4]/div/div[1]/div/div').innerText;
                let author = x('//*[@id="root"]/div[1]/div/div/main/section[5]/div/a/div/div[1]/h2') ? x('//*[@id="root"]/div[1]/div/div/main/section[5]/div/a/div/div[1]/h2').innerText : ''

                let price = x('//*[@id="root"]/div[1]/div/div/main/section[3]/div[1]/div/h3').innerText;
                let location = x('//*[@id="root"]/div[1]/div/div/main/section[6]/div[1]/div/p[1]').innerText.split(',')[0].trim();

                let gallerys = []
                let img = x('//*[@id="root"]/div[1]/div/div/main/section[2]/div/div[2]/div/div/div[1]')
                    ?
                    x('//*[@id="root"]/div[1]/div/div/main/section[2]/div/div[2]/div/div/div[1]').querySelectorAll('.swiper-slide')
                    .forEach(e => {
                        if(e) {
                            gallerys.push(e.querySelector('img').getAttribute('src'))
                        }
                    })
                    :
                    (
                        x('//*[@id="root"]/div[1]/div/div/main/section[2]/div/div/div/div')[0]
                        ?
                        gallerys.push(
                            x('//*[@id="root"]/div[1]/div/div/main/section[2]/div/div/div/div').querySelector('img').getAttribute('src')
                        )
                        :
                        gallerys.push([])
                    )


                let options = []
                x('//*[@id="root"]/div[1]/div/div/main/section[3]/div[2]/div').querySelectorAll('div')
                    .forEach((el, index) => {
                        let param = el.querySelector('span:first-child').innerText
                        let val = el.querySelector('span:last-child').innerText.trim().replace(': ', '')
                        options.push({param, val})
                })


                gallerys = gallerys.filter(e => e !== null)
                return {
                    gallerys,
                    title,
                    author,
                    content,
                    options,
                    price,
                    location,
                    id,
                    cookie
                }
            }

        }, store, activeCookieVal);

        await page.waitFor(5000);
        await browser.close();

        if(result) {
            const res = axios(olxUri + '/api/v1/offers/'+result.id+'/phones/', {
              headers: {
                'Authorization': 'Bearer ' + result.cookie
              }
            }).then(res => res.data).then(({data}) => Object.assign(result, data))
            return res;
        }   else {
            return null;
        }


    }
    else {
        return null;
    }
}

const phoneParser = async (from, to) => {
    console.log('Start')
        for (var i = from; i < to; i++) {
            console.log('Start Page: '+i);
                const parsedLinks = await parse(i);
                for (let [index, link] of parsedLinks.entries()) {
                    await detailParse(link).then(data => {
                        if(data && data.phones[0]) {
                            fs.writeFileSync('phones.txt', data.phones[0].replace(/\s|\W/g, '')+'\r\n', {flag: 'a'});
                        }
                    })
                };
            console.log('End Page: '+i);
        };
    console.log('End')
}



/* Template */
const chatData = (obj) => {
    /*gallerys
    title
    author
    content
    options
    price
    location*/
    let options = ``;
    obj.options.forEach((data, index) => {
        options += `${data.param}: ${data.val} \n`
    });

    const wrapper = `
    ${obj.title} ❗️
    💰 ${obj.price}
    ☎️ ${obj.phones[0]}
    🚩 #${obj.location.replace("'", '')}
    ${options}`

    if(obj.phones[0]){
        return wrapper
    }
}
const sendToChannel = async (pageNum, limit) => {
    const parsedLinks = await parse(pageNum, limit);
    for (let [index, link] of parsedLinks.entries()) {
        console.log('Start Page: '+index);
            try {
                console.log(link)
                await detailParse(link).then(data => {
                    if(data && data.phones[0]) {
                        data.phones[0] = phoneFormat(data.phones[0])
                        bot.sendPhoto(chat_id, data.gallerys[0], { caption: chatData(data) });
                    }
                })
            } catch(e) {
                // statements
                throw new Error(`Error: ${e}`)
            }
        console.log('End Page: '+index);
    };
}

const phoneFormat = (num) => {
    const phone = num.replace(/\s|\W/g, '');
    if(phone.length == 12) {
        return phone.replace(/\s|\W/g, '').replace(/(\d{3})(\d{2})(\d{3})(\d{2})(\d{1})/, "+($1) $2 $3-$4-$5");
    }
    else if(phone.length == 9) {
        return phone.replace(/(\d{2})(\d{3})(\d{2})(\d{1})/, "+(998) $1 $2 $3 $4");
    }
    else {
        return null
    }

}

const addContact = async () => {
    const url = `https://web.telegram.org/`;
    const browser = await puppeteer.launch({
        headless: false,
        userDataDir: 'C:\\puppeteerData',
    });
    const page = await browser.newPage();

    await page.goto(url, {
        waitUntil: 'load',
        // Remove the timeout
        timeout: 0
    })

    const readFile = async (path) => {
        return new Promise((resolve, reject) => {
          fs.readFile(path, 'utf8', function (err, data) {
            if (err) {
              reject(err);
            }
            const phones = data.toString().split("\n").map(phones => {
                phones = phones.trim()
                if(phones.length == 12) {
                    var num = '+'+phones;
                    phones = num
                }
                if(phones.length == 9) {
                    var num = '+998'+phones;
                    phones = num
                }
                return phones
            })
            resolve(phones);
          });
        });
    }

    const addContact = async (phoneNumber) => {
        // ADD CONTACT
        await page.$eval('.dropdown-menu li:nth-child(2) a', elem => elem.click());
        // NEW CONTACT
        await page.$eval('[my-i18n="contacts_modal_new_contact"]', elem => elem.click());
        // TYPE PHONE
        await page.type('[ng-model="importContact.phone"]', phoneNumber);
        // TYPE FIRSTNAME
        await page.type('[ng-model="importContact.first_name"]', phoneNumber);
        // SUBMIT CONTACT
        await page.$eval('[ng-click="doImport()"]', elem => elem.click());
        // DISSMISS
        await page.$eval('.md_simple_modal_footer [ng-click="$dismiss()"]', elem => elem.click());
        await page.$eval('.md_modal_action_close', elem => elem.click());
        // WAIT SAVING CONTACT
        await page.waitFor(20000)
    }

    const phones = await readFile('phones.txt');
    for (let phone of phones) {
        await addContact(phone)
    };

    /*await fs.readFile('phones.txt', 'utf8', function(err, contents) {
        if(err) throw err;
        phones = contents.toString().split("\n")
        for(i in phones) {
            if(phones[i]) {
                phones[i] = phones[i].trim()
                if(phones[i].length == 12) {
                    var num = '+'+phones[i];
                    await addContact(num)
                }
                if(phones[i].length == 9) {
                    var num = '+998'+phones[i];
                    await addContact(num)
                }

            }
        }
    });*/

    await browser.close();
}

(async () => {
    // await phoneParser(3, 26);
    // await sendToChannel(18, 2); // pageNum, limit
    // await addContact();
})();