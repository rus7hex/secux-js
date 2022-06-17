# `@secux/transport-reactnative`

> SecuX Hardware Wallet react native API for communication layer

## Installation
`npm install @secux/transport-reactnative react-native-ble-plx react-native-settings`

## Configuration

### IOS
1. Enter `ios` folder and run `pod update`
2. Add `NSBluetoothAlwaysUsageDescription` in `info.plist` file. (it is a requirement since iOS 13)

### Android
1. Enter `android` folder, open `build.gradle` make sure that min SDK version is at least 18:
```groovy
buildscript {
    ext {
        ...
        minSdkVersion = 18
        ...
```
2. In `build.gradle` make sure to add jitpack repository to known repositories:
```groovy
allprojects {
    repositories {
      ...
      maven { url 'https://www.jitpack.io' }
    }
}
```
3. In `build.gradle` make sure that gradle version is at least 4.1.0:
```groovy
buildscript {
    dependencies {
        classpath("com.android.tools.build:gradle:4.1.0")
        ...
```
4. In `AndroidManifest.xml`, add Bluetooth permissions:
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    ...
    <uses-permission android:name="android.permission.BLUETOOTH"/>
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN"/>
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
    <uses-feature android:name="android.hardware.bluetooth_le" android:required="true"/>
    ...
```

## Bluetooth connection flow
1. Scanning SecuX devices by bluetooth to get MAC_ADDRESS/UUID. If use given MAC_ADDRESS/UUID, you can skip step 1.
2. Connect to SecuX device with MAC_ADDRESS/UUID.
3. Do OTP authentication that showing on SecuX device.
4. Bluetooth connection finished.

## Example
In below example, we use `react-native-dialog` npm package to do OTP process.
```js
import React from 'react';
import { StyleSheet, Text, View, Button, FlatList } from 'react-native';
import Dialog from 'react-native-dialog';
import { SecuxReactNativeBLE } from "@secux/transport-reactnative";


export default function App() {
    const [scanning, SetScanning] = React.useState(false);
    const [dialog, ShowDialog] = React.useState(false);
    const [otp, SetOTP] = React.useState();
    const [devices, SetDevices] = React.useState([]);
    const [transport, SetTransport] = React.useState();


    const AddDevice = (device) => {
        device.clicked = false;
        SetDevices(x => [...x, device]);
    };

    const DeleteDevice = (device) => {
        SetDevices(x => x.filter(item => item.id !== device.id));
    };

    const scan = () => {
        SecuxReactNativeBLE.StartScan(AddDevice, DeleteDevice);
        SetScanning(true);
    };

    const connect = async (uid) => {
        SecuxReactNativeBLE.StopScan();

        const device = await SecuxReactNativeBLE.Create(
            uid,
            () => console.log("connected"),
            () => console.log("disconnected")
        );
        SetTransport(device);

        await device.Connect();

        ShowDialog(true);

        // device is connected
    };

    const otp_processing = async () => {
        const success = await transport.SendOTP(otp);

        if (success) ShowDialog(false);
    };

    return (
        <View style={styles.container}>
            <View style={{ flex: 1, alignItems: "center" }}>
                <Text>Sample Project</Text>
                <Button>
                    title="BLE Connect" 
                    onPress={scan} disabled={scanning} 
                <Button/>
                <FlatList> 
                    data={devices} 
                    renderItem={
                        ({ item }) => 
                        <Button> 
                            style={styles.item} 
                            title={item.name} 
                            disabled={item.clicked} 
                            onPress={
                                async () => { 
                                    item.clicked = true; 
                                    await connect(item.id); 
                                }
                            } 
                        <Button/>
                    }
                <FlatList/>
            </View>

            <View>
                <Dialog.Container visible={dialog}>
                    <Dialog.Title>OTP Authentication</Dialog.Title>
                    <Dialog.Input value={otp} onChangeText={SetOTP} />
                    <Dialog.Button label="OK" onPress={otp_processing} />
                </Dialog.Container>
            </View>
        </View >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 22,
    },
    item: {
        padding: 10,
        fontSize: 18,
        height: 44,
    },
});
```

## Notes
1. For android, location services should be turned on when scanning devices.
2. After call .StartScan(), remember to call .StopScan().