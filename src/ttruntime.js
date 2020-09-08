const puppeteer = require('puppeteer');
const sourceMap = require('source-map');
const fs = require('fs');
const yargs = require('yargs');

function getErrorFromMsg(msg) {
    const msgRegex = /Required: (?:.+) for (?:.+), but got string\. Error(.+)/s;
    const match = msg.match(msgRegex);
    if (match) {
        const stack = match[1];
        const lines = stack.split('\n');
        return lines[2].trim();
    }
    return '';
}

function parseLocationFromUrl(url, compiledSourcePath) {
    const escape = (string) => {
        return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    };
    const urlRegex = new RegExp(`${escape((url))}\\/static\\/(.+):(\\d+):(\\d+)`);
    const match = compiledSourcePath.match(urlRegex);
    if (match) {
        const path = match[1];
        const line = match[2];
        const col = match[3];
        return [path, line, col];
    }
    return [];
}

async function getOriginalLocation(url, root, compiledSource) {
    const location = parseLocationFromUrl(url, compiledSource);
    if (!location) {
        return;
    }
    const [path, line, col] = location;
    const sourceMapPath = `${root}/${path}.map`;
    const tsPath = `${root}/${path.replace('.js', '.ts')}`;
    try {
        if (!fs.existsSync(sourceMapPath)) {
            console.log(`Path ${sourceMapPath} not found.`);
            return;
        }
        const rawData = fs.readFileSync(`${root}/${path}.map`, 'utf8');
        const rawSourceMap = JSON.parse(rawData);
        const res = await sourceMap.SourceMapConsumer.with(rawSourceMap, null, (consumer) => {
            return consumer.originalPositionFor({source: tsPath, line: line - 1, column: col - 1});
        });
        console.log(`at ${res.source}:${res.line + 1}:${res.column + 1}`);
    } catch (err) {
        console.error(err);
    }
}
const argv = yargs
    .option('endpoint', {
        alias: 'e',
        description: 'Endpoint of running application to scan. Default: http://localhost:8080',
        type: 'string',
    })
    .option('path', {
        alias: 'p',
        description: 'Path to the tested project\'s root. Default: this project\'s root',
        type: 'string',
    })
    .help()
    .alias('help', 'h')
    .argv;

(async () => {
    const url = argv.endpoint ? argv.endpoint : 'http://localhost:8080';
    const path = argv.path ? argv.path : appRoot;
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const errors = new Map();

    page.on('console', (msg) => {
        const file = getErrorFromMsg(msg.text());

        if (!errors.has(file)) {
            errors.set(file, []);
        }
        errors.get(file).push(msg.text());
    });
    await page.goto(url, {waitUntil: 'networkidle2'});
    await browser.close();

    console.log(`Found TrustedTypes violations: ${errors.size}`);
    errors.forEach((val, key) => {
        const locationRegex = /at (?:.+) \((.+)\)/;
        const match = key.match(locationRegex);
        if (match) {
            getOriginalLocation(url, path, match[1]);
        }
    });
})();