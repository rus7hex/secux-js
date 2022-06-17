[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lerna.js.org/)
[![view on npm](https://badgen.net/npm/v/@secux/app-luna)](https://www.npmjs.com/package/@secux/app-luna)
[![npm module downloads](https://badgen.net/npm/dt/@secux/app-luna)](https://www.npmjs.org/package/@secux/app-luna)

# `@secux/app-luna`

> SecuX Hardware Wallet LUNA API

## Usage

```ts
import { SecuxLUNA } from "@secux/app-luna";
```

First, create instance of ITransport
- [Web Usb](https://www.npmjs.com/package/@secux/transport-webusb)
- [Web Bluetooth](https://www.npmjs.com/package/@secux/transport-webble)
- [React Native Bluetooth](https://www.npmjs.com/package/@secux/transport-reactnative)

<br />

## Examples
1. Get account address
```
const path = "m/44'/330'/0'/0/0";
const address = await device.getAddress(path);

/*

// transfer data to hardware wallet by custom transport layer
const data = SecuxLUNA.prepareAddress(path);
const response = await device.Exchange(data);
const address = SecuxLUNA.resolveAddress(response);

*/
```

2. Sign transaction
    - transfer asset (MsgSend)
    ```ts
    const signer = {
        path: "m/44'/330'/0'/0/0",
        accountNumber: 12345,
        sequence: 1,
    };
    const params = {
        fee: { uluna: 3000 },
        gasLimit: 12345,
    };
    const send = new SecuxLUNA.MsgSend(from, to, { uluna: 1e6 });

    const { multi_command, serialized } = await device.sign(
        [signer],
        [send],
        params
    );
    const responseList = [];
    for (const data of multi_command) {
        const rsp = await device.Exchange(data);
        responseList.push(rsp);
    }
    const raw_tx = SecuxLUNA.resolveTransaction(responseList, serialized);

    /*

    // transfer data to hardware wallet by custom transport layer.
    const { commands, serialized } = SecuxLUNA.prepareSign(
        [
            { ...signer, publickey: "02acb4bc267db7774614bf6011c59929b006c2554386a3090baff0b3fc418ec044" }
        ],
        [send],
        params
    });
    const responseList = [];
    for (const data of commands) {
        const rsp = await device.Exchange(data);
        responseList.push(rsp);
    }
    const raw_tx = SecuxLUNA.resolveTransaction(responseList, serialized);

    */
    ```

    - execute contract
    ```ts
    const swap = new SecuxLUNA.MsgExecuteContract(
        "terra1amdttz2937a3dytmxmkany53pp6ma6dy4vsllv", 
        "terra156v8s539wtz0sjpn8y8a8lfg8fhmwa7fy22aff", 
        {
            swap: {
                offer_asset: {
                    amount: 1e6,
                    info: {
                        native_token: { denom: "uluna" },
                    },
                },
            },
        },
        { uluna: 1e6 }
    );

    const { multi_command, serialized } = await device.sign(
        [signer],
        [swap],
        params
    );
    
    // ... (same as above)
    ```

    - delegate
    ```ts
    const delegate = new SecuxLUNA.MsgDelegate(
        "terra1amdttz2937a3dytmxmkany53pp6ma6dy4vsllv", 
        "terravaloper1vf2209f5y7s4a66n5ng7wmup5gcc2kghhzy89w", 
        "1000000"
    );

    const { multi_command, serialized } = await device.sign(
        [signer],
        [delegate],
        params
    );
    
    // ... (same as above)
    ```

    - withdraw
    ```ts
    const withdraw = new SecuxLUNA.MsgWithdrawDelegatorReward(
        "terra1amdttz2937a3dytmxmkany53pp6ma6dy4vsllv", 
        "terravaloper1vf2209f5y7s4a66n5ng7wmup5gcc2kghhzy89w" 
    );

    const { multi_command, serialized } = await device.sign(
        [signer],
        [withdraw],
        params
    );
    
    // ... (same as above)
    ```

    - undelegate
    ```ts
    const undelegate = new SecuxLUNA.MsgUndelegate(
        "terra1amdttz2937a3dytmxmkany53pp6ma6dy4vsllv", 
        "terravaloper1vf2209f5y7s4a66n5ng7wmup5gcc2kghhzy89w",
        "1000000"
    );

    const { multi_command, serialized } = await device.sign(
        [signer],
        [undelegate],
        params
    );
    
    // ... (same as above)
    ```

    - redelegate
    ```ts
    const redelegate = new SecuxLUNA.MsgBeginRedelegate(
        "terra1amdttz2937a3dytmxmkany53pp6ma6dy4vsllv", 
        "terravaloper1vf2209f5y7s4a66n5ng7wmup5gcc2kghhzy89w",
        "terravaloper1vk20anceu6h9s00d27pjlvslz3avetkvnwmr35",
        "1000000"
    );

    const { multi_command, serialized } = await device.sign(
        [signer],
        [redelegate],
        params
    );
    
    // ... (same as above)
    ```


# API Reference
ERROR, Cannot find class.
<br/>
<br/>
<a name="AddressType"></a>

## AddressType : <code>enum</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| account | <code>string</code> | account |
| validator | <code>string</code> | validator |
| pubkey | <code>string</code> | pubkey |

<br/>
<a name="Signer"></a>

## Signer : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | BIP32 path, ex: m/44'/330'/0'/0/0 |
| publickey | <code>string</code> \| <code>Buffer</code> | secp256k1 publickey from `path` |
| sequence | <code>number</code> | the number of transactions sent from this address |
| accountNumber | <code>number</code> | the account number from blockchain |

<br/>
<a name="IMessage"></a>

## IMessage : <code>interface</code>
**Properties**

| Name | Type |
| --- | --- |
| toAmino | <code>function</code> | 
| toData | <code>function</code> | 
| toProto | <code>function</code> | 
| packAny | <code>function</code> | 

<br/>
<a name="TxOption"></a>

## TxOption : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| fee | <code>string</code> \| <code>Coins</code> | the amount of coins to be paid as a fee |
| gasLimit | <code>number</code> | the maximum gas that can be used in transaction processing |
| [chainId] | <code>string</code> | blockchain network identifier |
| [memo] | <code>string</code> |  |
| [timeoutHeight] | <code>string</code> | timeout height relative to the current block height |
| [payer] | <code>string</code> | payer’s account address |
| [granter] | <code>string</code> | granter’s account address |

<br/>
<a name="prepared"></a>

## prepared : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| commands | [<code>Array.&lt;communicationData&gt;</code>](#communicationData) | data for sending to device |
| serialized | [<code>communicationData</code>](#communicationData) | unsigned raw transaction |

<br/>

* * *

&copy; 2018-22 SecuX Technology Inc.

authors:<br/>
andersonwu@secuxtech.com