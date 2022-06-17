# `@secux/app-dash`

> SecuX Hardware Wallet DASH API

## Usage

```ts
import { SecuxDASH } from "@secux/app-dash";
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
        const path = "m/84'/5'/0'/0/0";
        const address = await device.getAddress(path);

        /*

        // transfer data to hardware wallet by custom transport layer.
        const data = SecuxDASH.prepareAddress(path);
        const response = await device.Exchange(data);
        const address = SecuxDASH.resolveAddress(response, path);

        */
        ```
    - segwit address (default script: P2SH_P2WPKH)
        ```ts
        const address = await device.getAddress("m/49'/5'/0'/0/0");
        ```
    - legacy address (default script: P2PKH)
        ```ts
        const address = await device.getAddress("m/44'/5'/0'/0/0");
        ```

2. Sign transaction (support legacy transaction currently).
```ts
const inputs = [
    {
        hash: "d1471f2c9ab2b7d1814c80f18f270efa779a489d696ee8db2ee13360111e486d",
        vout: 0,
        satoshis: 100000,
        path: "m/44'/5'/0'/0/0",
        // for custom transport layer, each utxo need publickey.
        // publickey: "026fa9a6f213b6ba86447965f6b4821264aaadd7521f049f00db9c43a770ea7405"
    },
    {
        hash: "cfdf9cac901d2b58d94b5794f71505ad13ef54739174a46657a11b74013b63de",
        vout: 0,
        satoshis: 99504,
        path: "m/44'/5'/2'/0/0",
        // for custom transport layer, each utxo need publickey.
        // publickey: "033bf91bf2d1798e11c09c6523a92bbe9d0fbde3b62af0daea97beaa51a05b0d31"
    }
];

const to = {
    address: "XefQmd7TDrF8cMUqTBuP5FUfA1frnUc8pW",
    satoshis: 99999
};

const utxo = {
    path: "m/44'/5'/3'/0/4",
    satoshis: 88888,
    // for custom transport layer, each utxo need publickey.
    // publickey: "02df0a5e4d0a03f70452f236c83995b5e37033931dab340b2570132ee727f9427b"
};

const { raw_tx } = await device.sign(inputs, { to, utxo });

/*

// transfer data to hardware wallet by custom transport layer.
const { commandData, rawTx } = SecuxDASH.prepareSign(inputs, { to, utxo });
const response = await device.Exchange(commandData);
const signed = SecuxDASH.resloveTransaction(response, rawTx, inputs.map(x => x.publickey));

*/
```

## API doc
Similar to [@secux/app-btc](https://www.npmjs.com/package/@secux/app-btc).