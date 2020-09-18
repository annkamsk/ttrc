const puppeteer = require('puppeteer');
const prettier = require('prettier');
const atob = require('atob');
const btoa = require('btoa');

const requestCache = new Map();

const urlPatterns = [
    '*'
]

function transform(source) {
    return prettier.format(source, {parser:'babel'});
}


async function intercept(page, patterns, transform) {
    const client = await page.target().createCDPSession();

    await client.send('Fetch.enable', {
        patterns: [
            {requestStage: 'Response', resourceType: 'Document'},
            {requestStage: 'Response', resourceType: 'Script'},
        ]
    });

    client.on('Fetch.requestPaused', async event => {
        const { requestId, resourceType, request, responseHeaders } = event;
        // console.log(`Intercepted ${request.url} {interception id: ${requestId}}`);

        const response = await client.send('Fetch.getResponseBody',{ requestId });

        const contentTypeHeader = responseHeaders.find(header => header.name === 'Content-Type');
        let newBody, contentType = contentTypeHeader.value;

        if (requestCache.has(response.body)) {
            newBody = requestCache.get(response.body);
        } else {
            const bodyData = response.base64Encoded ? atob(response.body) : response.body;
            try {
                if (contentType === 'text/javascript') {
                    newBody = transform(bodyData, { parser: 'babel' });
                } else {
                    newBody = bodyData;
                }
            } catch(e) {
                console.log(`Failed to process ${request.url} {interception id: ${requestId}}: ${e}`);
                newBody = bodyData
            }

            requestCache.set(response.body, newBody);
        }

        const newHeaders = responseHeaders;
        newHeaders.push({
            name: 'Content-Security-Policy-Report-Only', value: 'require-trusted-types-for \'script\';'
        });
        // console.log(`Continuing interception ${requestId}`)
        await client.send('Fetch.fulfillRequest', {
            requestId: requestId,
            responseHeaders: newHeaders,
            responseCode: 200,
            body: response.body
        });
    });
}

(async function main(){
    const browser = await puppeteer.launch({
        headless:false,
        devtools: true,
    });

    const page = (await browser.pages())[0];

    intercept(page, urlPatterns, transform);

    // browser.on('targetcreated', async (target) => {
    //     const page = await target.page();
    //     intercept(page, urlPatterns, transform);
    // });

})()