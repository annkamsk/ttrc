# Trusted Types Runtime Check

TTRC is a script for reporting [Trusted Types](https://github.com/w3c/webappsec-trusted-types) violations discovered at runtime. It produces a list of source TypeScript files with location of violation. 

It assumes that the tested application is already running with a defined default policy for Trusted Types violations and created source maps, so before running TTRC put the following code into the HTML files of documents you want to check:

```html
<meta http-equiv="Content-Security-Policy" content="require-trusted-types-for 'script';"/>

<script>
    const logAndReturn = (type) => (value) => {
        console.error(`Required: ${type} for ${value}, but got string. ${(new Error()).stack}`);
        return value;
    }
    trustedTypes.createPolicy('default', {
        createHTML: logAndReturn('TrustedHTML'),
        createScript: logAndReturn('TrustedScript'),
        createScriptURL: logAndReturn('TrustedScriptURL'),
    });
</script>
```
Then make sure that during the compilation the source maps are produced:
`tsconfig.json`:
```js
{
    "compilerOptions": {
            "sourceMap": true
    }
}
```

Build and run your application as usual.

## Build and Run

### Build
```shell script
git clone https://github.com/annkamsk/ttrc
cd ttrc

# Install dependencies
yarn
```

### Run
To run a check for the compatibility with Trusted Types use:
```shell script
yarn tt-runtime-check -e {TESTED APP's ENDPOINT} -p {TESTED APP's ROOT}
```
where {TESTED APP's ENDPOINT} defaults to `http://localhost:8080` and {TESTED APP's ROOT} to this project's root directory. 