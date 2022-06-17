# `@secux/utility`

> SecuX Hardware Wallet internal tools for SDK

## Logger module configuration (default: disabled)
1. Add the code to your project starting point:
```ts
require("@secux/utility/lib/logger");
```

2. Install following packages:
   - for web:        
        ```
        npm install --save-dev winston setimmediate
        ```
   - for react-native:
        ```
        npm install --save-dev react-native-logs
        ```

3. Configure global environment with your bundler or at project starting point:
    - for web:
        ```ts
        // use this line to trigger debug level
        process.env.DISTRIBUTION = "development";
        process.env.LOGGER = "winston";
        ```
    - for react-native:
        ```ts
        // use this line to trigger debug level
        process.env.DISTRIBUTION = "development";
        process.env.LOGGER = "react-native-logs";
        ```

## API doc
<a name="toExtenededPublicKey"></a>

## toExtenededPublicKey(path, parentFingerPrint, chainCode, publicKey) ⇒ <code>String</code>
Convert publicKey to extended publicKey

**Kind**: global function  
**Returns**: <code>String</code> - extended publicKey  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | BIP32 path |
| parentFingerPrint | <code>Buffer</code> | byte(4) |
| chainCode | <code>Buffer</code> | byte(32) |
| publicKey | <code>Buffer</code> | byte(33) |
