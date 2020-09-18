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
            {requestStage: 'Response', resourceType: 'CSPViolationReport'},
        ]
    });

    client.on('Fetch.requestPaused', async event => {
        const { requestId, resourceType, request, responseHeaders } = event;
        // console.log(`Intercepted ${request.url} {interception id: ${requestId}}`);
        if (resourceType === 'CSPViolationReport') {
            console.error(event);
        }
        const response = await client.send('Fetch.getResponseBody',{ requestId });

        const newHeaders = responseHeaders;
        newHeaders.push({
            name: 'Content-Security-Policy-Report-Only', value: 'require-trusted-types-for \'script\'; report-uri http://127.0.0.1:8080'
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