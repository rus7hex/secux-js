[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lerna.js.org/)
[![view on npm](https://badgen.net/npm/v/@secux/app-sol)](https://www.npmjs.com/package/@secux/app-sol)
[![npm module downloads](https://badgen.net/npm/dt/@secux/app-sol)](https://www.npmjs.org/package/@secux/app-sol)

# `@secux/app-sol`

> SecuX Hardware Wallet SOL API

## Usage

```ts
import { SecuxSOL } from "@secux/app-sol";
```

First, create instance of ITransport.
- [Web Usb](https://www.npmjs.com/package/@secux/transport-webusb)
- [Web Bluetooth](https://www.npmjs.com/package/@secux/transport-webble)
- [React Native Bluetooth](https://www.npmjs.com/package/@secux/transport-reactnative)

<br/>

## Examples
1. Get address of bip-32 path.
    - main account
        ```ts
        const path = "m/44'/501'/0'";
        const address = await device.getAddress(path);

        /*

        // transfer data to hardware wallet by custom transport layer.
        const data = SecuxBTC.prepareAddress(path);
        const response = await device.Exchange(data);
        const address = SecuxBTC.resolveAddress(response, path);

        */
        ```
    - associated account
        ```ts
        const address = await device.getAddress(
            "m/44'/501'/0'", 
            // USDC
            { mintAccount: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" }
        );
        ``` 
    - account with seed
        ```ts
        const address = await device.getAddress(
            "m/44'/501'/0'",
            { 
                seed: "seed",
                programId: "Stake11111111111111111111111111111111111111"
            }
        );
        ```

2. Sign transaction.
    - transfer asset
        ```ts
        const { raw_tx } = await device.sign(
            "<recentBlockhash>",
            instructions: [
                {
                    type: "transfer",
                    params: {
                        to: "<reciever account>",
                        lamports: 1e9,
                        path: "m/44'/501'/0'"
                    }
                }
            ]
        );

        /*

        // transfer data to hardware wallet by custom transport layer.
        const { commandData, serialized } = SecuxSOL.prepareSign(
            "<recentBlockhash>",
            instructions: [
                {
                    type: "transfer",
                    params: {
                        from: "<sender's account>",
                        to: "<reciever's account>",
                        lamports: 1e9,
                        path: "m/44'/501'/0'"
                    }
                }
            ]
        );
        const response = await device.Exchange(commandData);
        const raw_tx = SecuxSOL.resloveTransaction(response, serialized);

        */
        ```

    - transfer SPL token
        ```ts
        const { raw_tx } = await device.sign(
            "<recentBlockhash>",
            instructions: 
                SecuxSOL.Action.transferToken(
                    {
                        to: "<reciever's account>",
                        owner: "<sender's account>",
                        amount: 1e6,
                        mint: "<token mint account>",
                        decimal: 6,
                        path: "m/44'/501'/0'",
                        // create ATA for reciever
                        createAccount: true
                    }
                )
        );
        ```

    - native staking
        ```ts
        const { raw_tx } = await device.sign(
            "<recentBlockhash>",
            instructions: 
                SecuxSOL.Action.stake(
                    {
                        owner: "<main account>",
                        stake: "<stake account>",
                        vote: "<vote account>",
                        lamports: 1e9,
                        path: "m/44'/501'/0'",

                        // if give a seed, the createWithSeed instruction will be included.
                        // stake: "<arbitrary string>"
                    }
                )
        );
        ```

    - unstake
        ```ts
        const { raw_tx } = await device.sign(
            "<recentBlockhash>",
            instructions: 
                SecuxSOL.Action.unstake(
                    {
                        owner: "<main account>",
                        stake: "<stake account or seed>",
                        lamports: <withdraw amount>,
                        path: "m/44'/501'/0'"
                    }
                )
        );
        ```


# API Reference
SOL package for SecuX device

**Kind**: global class  

* [SecuxSOL](#SecuxSOL)
    * [.addressConvert(publickey, [option])](#SecuxSOL.addressConvert) ⇒ <code>string</code>
    * [.prepareAddress(path)](#SecuxSOL.prepareAddress) ⇒ [<code>communicationData</code>](#communicationData)
    * [.resolveAddress(response, [option])](#SecuxSOL.resolveAddress) ⇒ <code>string</code>
    * [.preparePublickey(path)](#SecuxSOL.preparePublickey) ⇒ [<code>communicationData</code>](#communicationData)
    * [.resolvePublickey(response)](#SecuxSOL.resolvePublickey) ⇒ <code>string</code>
    * [.prepareSign(feePayer, content)](#SecuxSOL.prepareSign) ⇒ [<code>prepared</code>](#prepared)
    * [.resolveSignatureList(response)](#SecuxSOL.resolveSignatureList) ⇒ <code>Array.&lt;string&gt;</code>
    * [.resolveTransaction(response, serialized)](#SecuxSOL.resolveTransaction) ⇒ <code>string</code>

<br/>
<a name="SecuxSOL.addressConvert"></a>

### **SecuxSOL.addressConvert(publickey, [option]) ⇒ <code>string</code>**
*Convert ed25519 publickey to SOL address.*

**Returns**: <code>string</code> - address  

| Param | Type | Description |
| --- | --- | --- |
| publickey | <code>string</code> \| <code>Buffer</code> | ed25519 publickey |
| [option] | [<code>ATAOption</code>](#ATAOption) \| [<code>SeedOption</code>](#SeedOption) |  |

<br/>
<a name="SecuxSOL.prepareAddress"></a>

### **SecuxSOL.prepareAddress(path) ⇒ [<code>communicationData</code>](#communicationData)**
*Prepare data for SOL address.*

**Returns**: [<code>communicationData</code>](#communicationData) - data for sending to device  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | BIP32 path (hardened child key), ex: m/44'/501'/0'/0' |

<br/>
<a name="SecuxSOL.resolveAddress"></a>

### **SecuxSOL.resolveAddress(response, [option]) ⇒ <code>string</code>**
*Generate SOL address from response data.*

**Returns**: <code>string</code> - SOL address  

| Param | Type | Description |
| --- | --- | --- |
| response | [<code>communicationData</code>](#communicationData) | data from device |
| [option] | [<code>ATAOption</code>](#ATAOption) \| [<code>SeedOption</code>](#SeedOption) |  |

<br/>
<a name="SecuxSOL.preparePublickey"></a>

### **SecuxSOL.preparePublickey(path) ⇒ [<code>communicationData</code>](#communicationData)**
*Prepare data for ed25519 publickey.*

**Returns**: [<code>communicationData</code>](#communicationData) - data for sending to device  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | BIP32 path (hardened child key), ex: m/44'/501'/0'/0' |

<br/>
<a name="SecuxSOL.resolvePublickey"></a>

### **SecuxSOL.resolvePublickey(response) ⇒ <code>string</code>**
*Resove ed25519 publickey from response data.*

**Returns**: <code>string</code> - ed25519 publickey (hex string)  

| Param | Type | Description |
| --- | --- | --- |
| response | [<code>communicationData</code>](#communicationData) | data from device |

<br/>
<a name="SecuxSOL.prepareSign"></a>

### **SecuxSOL.prepareSign(feePayer, content) ⇒ [<code>prepared</code>](#prepared)**
*Prepare data for signing.*

**Returns**: [<code>prepared</code>](#prepared) - prepared object  

| Param | Type | Description |
| --- | --- | --- |
| feePayer | <code>string</code> | solana account |
| content | [<code>txDetail</code>](#txDetail) | transaction object |

<br/>
<a name="SecuxSOL.resolveSignatureList"></a>

### **SecuxSOL.resolveSignatureList(response) ⇒ <code>Array.&lt;string&gt;</code>**
*Reslove signatures from response data.*

**Returns**: <code>Array.&lt;string&gt;</code> - signature array (base58 encoded)  

| Param | Type | Description |
| --- | --- | --- |
| response | [<code>communicationData</code>](#communicationData) | data from device |

<br/>
<a name="SecuxSOL.resolveTransaction"></a>

### **SecuxSOL.resolveTransaction(response, serialized) ⇒ <code>string</code>**
*Resolve transaction for broadcasting.*

**Returns**: <code>string</code> - signed transaction (hex)  

| Param | Type | Description |
| --- | --- | --- |
| response | [<code>communicationData</code>](#communicationData) | data from device |
| serialized | [<code>communicationData</code>](#communicationData) |  |

<br/>

<br/>
<br/>
<a name="ATAOption"></a>

## ATAOption : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| mintAccount | <code>string</code> | token mint address |

<br/>
<a name="SeedOption"></a>

## SeedOption : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| seed | <code>string</code> | arbitary string (UTF-8) |
| programId | <code>string</code> | program address |

<br/>
<a name="accounts"></a>

## accounts : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| publickey | <code>string</code> \| <code>Buffer</code> | Ed25519 publickey |
| isSigner | <code>boolean</code> |  |
| isWritable | <code>boolean</code> |  |
| [path] | <code>string</code> | the path for signing |

<br/>
<a name="Instruction"></a>

## Instruction : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| programId | <code>string</code> | program address |
| accounts | [<code>accounts</code>](#accounts) |  |
| data | <code>string</code> \| <code>Buffer</code> | hex string or buffer |

<br/>
<a name="BuiltinInstruction"></a>

## BuiltinInstruction : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| type | <code>string</code> | instruction type |
| params | <code>any</code> | parameters |

<br/>
<a name="txDetail"></a>

## txDetail : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| recentBlockhash | <code>string</code> | a recent blockhash |
| instructions | <code>Array.&lt;(Instruction\|BuiltinInstruction)&gt;</code> | a least one instruction in a transaction |
| [feepayerPath] | <code>string</code> | option for signing via SecuX wallet |

<br/>
<a name="prepared"></a>

## prepared : <code>object</code>
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| commandData | [<code>communicationData</code>](#communicationData) | data for sending to device |
| rawTx | <code>string</code> | unsigned raw transaction |

<br/>

* * *

&copy; 2018-22 SecuX Technology Inc.

authors:<br/>
andersonwu@secuxtech.com