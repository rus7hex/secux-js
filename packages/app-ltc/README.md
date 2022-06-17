# `@secux/app-ltc`

> SecuX Hardware Wallet LTC API

## Usage

```ts
import { SecuxLTC } from "@secux/app-ltc";
```

First, create instance of ITransport.
- [Web Usb](https://www.npmjs.com/package/@secux/transport-webusb)
- [Web Bluetooth](https://www.npmjs.com/package/@secux/transport-webble)
- [React Native Bluetooth](https://www.npmjs.com/package/@secux/transport-reactnative)

<br/>

## Examples
1. Get address by purpose and script type.
    - native segwit address (default script: P2WPKH)
        ```ts
        const path = "m/84'/2'/0'/0/0";
        const address = await device.getAddress(path);

        /*

        // transfer data to hardware wallet by custom transport layer.
        const data = SecuxLTC.prepareAddress(path);
        const rsp = await GetDevice().Exchange(data);
        const address = SecuxLTC.resolveAddress(rsp, path);

        */
        ```
    - segwit address (default script: P2SH_P2WPKH)
        ```ts
        const address = await device.getAddress("m/49'/2'/0'/0/0");
        ```
    - legacy address (default script: P2PKH)
        ```ts
        const address = await device.getAddress("m/44'/2'/0'/0/0");
        ```

2. Sign transaction (native segwit has not supported yet).
```ts
const inputs = [
    {
        hash: "7e874e94ae254287ec713b116b7af73067a5e15eb5c19e879d1e465ca53e7d63",
        vout: 0,
        satoshis: 301331,
        path: "m/44'/2'/0'/0/0",
        // for custom transport layer, each utxo need publickey.
        // publickey: "030fe9d8d0e15d432d1ae9b3c52f4cb6e37e3c7a41af0139783da09eab85a182dc"
    },
    {
        hash: "ebd04672981fa215f130ecdbac56f386e4e76326eaa808e081f67c2de79d949c",
        vout: 0,
        satoshis: 10000,
        path: "m/49'/2'/0'/0/0",
        // for custom transport layer, each utxo need publickey.
        // publickey: "03f7a0a5d44504ea8a2494c7e32c895ba4968d3dab66a4d790380be8b0539f36bc"
    }
];

const to = {
    address: "MFkcBAGgM664drwch3G3L4VWByPQVABQ3Q",
    satoshis: 310000
};

const utxo = {
    path: "m/44'/2'/0'/0/0",
    satoshis: 331,
    // for custom transport layer, each utxo need publickey.
    // publickey: "030fe9d8d0e15d432d1ae9b3c52f4cb6e37e3c7a41af0139783da09eab85a182dc"
};

const { raw_tx } = await device.sign(inputs, { to, utxo });

/*

// transfer data to hardware wallet by custom transport layer.
const { commandData, rawTx } = SecuxLTC.prepareSign(inputs, { to, utxo });
const response = await device.Exchange(commandData);
const signed = SecuxLTC.resloveTransaction(response, rawTx, inputs.map(x => x.publickey));

*/
```

## API doc
Similar to [@secux/app-btc](https://www.npmjs.com/package/@secux/app-btc).