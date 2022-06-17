# `@secux/app-doge`

> SecuX Hardware Wallet DOGE API

## Usage

```ts
import { SecuxDOGE, ScriptType } from "@secux/app-doge";
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
        const path = "m/84'/3'/0'/0/0";
        const address = await device.getAddress(path);

        /*

        // transfer data to hardware wallet by custom transport layer.
        const data = SecuxDOGE.prepareAddress(path);
        const response = await device.Exchange(data);
        const address = SecuxDOGE.resolveAddress(response, path);

        */
        ```
    - segwit address (default script: P2SH_P2WPKH)
        ```ts
        const address = await device.getAddress("m/49'/3'/0'/0/0");
        ```
    - legacy address (default script: P2PKH)
        ```ts
        const address = await device.getAddress("m/44'/3'/0'/0/0");
        ```

2. Sign transaction (support legacy transaction currently).
```ts
const inputs = [
    {
        hash: "d518fa4c4c0ebbfec834a2bee55687656f5e8ab87ec91b0929e34bf4f9a97c2c",
        vout: 0,
        satoshis: 500000000,
        path: "m/44'/3'/1'/0/3",
        // for custom transport layer, each utxo need publickey.
        // publickey: "035e4e31aec14a962972bdf97030586929f898927e2fb271d0174df3e4c8f81f47"
    },
    {
        hash: "a1acc8dd173fb4d2b010a60883752a60e5b27f1dc3e940ad5542781715522ca5",
        vout: 0,
        satoshis: 2052800000,
        path: "m/44'/3'/0'/0/4",
        // for custom transport layer, each utxo need publickey.
        // publickey: "03b4b21789f999f8c268d77ff0f6ed80884ec088ddd1b2d10055981d6bc393308a"
    },
    {
        hash: "8e4e5084caa1382d755ac11a8f9cdb7a5e2f903703ef51bf2910c3eea2696ea8",
        vout: 0,
        satoshis: 300000000,
        path: "m/44'/3'/0'/0/0",
        // for custom transport layer, each utxo need publickey.
        // publickey: "02cc6b0dc33aabcf3a23643e5e2919a80c50fb3dd2129ce409bbc5f0d4643d05e0"
    }
];

const to = {
    address: "DKiNgqGMrFXrPDSLmpnsxNAqJ3WUQX376f",
    satoshis: 8888888
};

const utxo = {
    path: "m/44'/3'/0'/0/0",
    satoshis: 700000000,
    // for custom transport layer, each utxo need publickey.
    // publickey: "02cc6b0dc33aabcf3a23643e5e2919a80c50fb3dd2129ce409bbc5f0d4643d05e0"
};

const { raw_tx } = await device.sign(inputs, { to, utxo });

/*

// transfer data to hardware wallet by custom transport layer.
const { commandData, rawTx } = SecuxDOGE.prepareSign(inputs, { to, utxo });
const response = await device.Exchange(commandData);
const signed = SecuxDOGE.resloveTransaction(response, rawTx, inputs.map(x => x.publickey));

*/
```

## API doc
Similar to [@secux/app-btc](https://www.npmjs.com/package/@secux/app-btc).