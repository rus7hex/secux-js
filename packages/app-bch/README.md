# `@secux/app-bch`

> SecuX Hardware Wallet BCH API

## Usage

```ts
import { SecuxBCH } from "@secux/app-bch";
```

First, create instance of ITransport.
- [Web Usb](https://www.npmjs.com/package/@secux/transport-webusb)
- [Web Bluetooth](https://www.npmjs.com/package/@secux/transport-webble)
- [React Native Bluetooth](https://www.npmjs.com/package/@secux/transport-reactnative)

<br/>

## Examples
1. Get address by BIP32 path.
    - classic address
        ```ts
        const path = "m/44'/145'/0'/0/0";
        const address = await device.getAddress(path);

        /*

        // transfer data to hardware wallet by custom transport layer.
        const data = SecuxBCH.prepareAddress(path);
        const response = await device.Exchange(data);
        const address = SecuxBCH.resolveAddress(response, path);

        */
        ```
    - p2sh address
        ```ts
        const address = await device.getAddress("m/49'/145'/0'/0/0");
        ```

2. Sign transaction.
```ts
const inputs = [
    {
        hash: "b4a0e0afd8bf99b8360a22a091b1601dc5bdbdda1ab2ab2d7e74f60f97a1f4ad",
        vout: 0,
        satoshis: 77576,
        path: "m/44'/145'/0'/0/0",
        // for custom transport layer, each utxo need publickey.
        // publickey: "037baee246604b2209ba0c56eb1bf4ad8d1aad6c1e5e7ce9fe5f385659d963aba9"
    },
    {
        hash: "5b6783feca093f4051b46971a225a4ad0d85e4a7025003c33eee9228f177ae1b",
        vout: 0,
        satoshis: 117885,
        path: "m/44'/145'/1'/0/0"
    }
];

const to = {
    address: "qqj3dr364rw9eyv4ke848kpu8aheuf8llc9pwu3smu",
    satoshis: 11111
};

const utxo = {
    path: "m/44'/145'/0'/0/2",
    satoshis: 16666,
    // for custom transport layer, publickey needed with path.
    // publickey: "03f496d36bbedbfb78bc61a5c6f20c368dcde97bd0ca174cc54cc0ccff15dc60c5"
};

const { raw_tx } = await device.sign(inputs, { to, utxo });

/*

// transfer data to hardware wallet by custom transport layer.
const { commandData, rawTx } = SecuxBCH.prepareSign(inputs, { to, utxo });
const response = await device.Exchange(commandData);
const signed = SecuxBCH.resloveTransaction(response, rawTx, inputs.map(x => x.publickey));

*/
```

## API doc
Similar to [@secux/app-btc](https://www.npmjs.com/package/@secux/app-btc).