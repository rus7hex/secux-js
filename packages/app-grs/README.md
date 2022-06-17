# `@secux/app-grs`

> SecuX Hardware Wallet GRS API

## Usage

```ts
import { SecuxGRS } from "@secux/app-grs";
```

First, create instance of ITransport.
- [Web Usb](https://www.npmjs.com/package/@secux/transport-webusb)
- [Web Bluetooth](https://www.npmjs.com/package/@secux/transport-webble)
- [React Native Bluetooth](https://www.npmjs.com/package/@secux/transport-reactnative)

<br/>

## Examples
1. Get address by BIP32 path.
    - native segwit address (default script: P2WPKH)
        ```ts
        const path = "m/84'/17'/0'/0/0";
        const address = await device.getAddress(path);

        /*

        // transfer data to hardware wallet by custom transport layer.
        const data = SecuxGRS.prepareAddress(path);
        const response = await device.Exchange(data);
        const address = SecuxGRS.resolveAddress(response, path);

        */
        ```
    - segwit address (default script: P2SH_P2WPKH)
        ```ts
        const address = await device.getAddress("m/49'/17'/0'/0/0");
        ```
    - legacy address (default script: P2PKH)
        ```ts
        const address = await device.getAddress("m/44'/17'/0'/0/0");
        ```

2. Sign transaction (native segwit has not supported yet).
```ts
const inputs = [
    {
        hash: "021fd09c855a2c742b4d25bcabf7b0a93d2f81e686875d29173d2527d3f93383",
        vout: 0,
        satoshis: 489957866,
        path: "m/44'/17'/0'/0/0",
        // for custom transport layer, each utxo need publickey.
        // publickey: "030f25e157a5ddc119bf370beb688878a3600461eb5c769a5556bdfe225d9a246e"
    },
    {
        hash: "378b0fcdb5fd9b3ac93a54318ab0c5a514de7e8ab757358610c7bbda0352c544",
        vout: 0,
        satoshis: 1000000,
        path: "m/49'/17'/0'/0/0",
        // for custom transport layer, each utxo need publickey.
        // publickey: "0212f4f7e43bae1bc53ef94dbef85f8348550975f5fd8f3693c19757223692e8dd"
    }
];

const to = {
    address: "38kpyoty76H1c6wWo7cfbPYNB88RsMV8AB",
    satoshis: 400000000
};

const utxo = {
    path: `m/44'/17'/0'/0/7`,
    satoshis: 60000000,
    // for custom transport layer, each utxo need publickey.
    // publickey: "0270806ba59d0abe13f6a0a13d2997f358fca3de938aec7f52bc78e7121d24ae23"
}

const { raw_tx } = await device.sign(inputs, { to, utxo });

/*

// transfer data to hardware wallet by custom transport layer.
const { commandData, rawTx } = SecuxGRS.prepareSign(inputs, { to, utxo });
const response = await device.Exchange(commandData);
const signed = SecuxGRS.resloveTransaction(response, rawTx, inputs.map(x => x.publickey));

*/
```

## API doc
Similar to [@secux/app-btc](https://www.npmjs.com/package/@secux/app-btc).