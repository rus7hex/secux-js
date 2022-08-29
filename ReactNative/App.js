import React from 'react';
import { StyleSheet, Text, View, Button, FlatList } from 'react-native';
import Dialog from 'react-native-dialog';
import { SecuxReactNativeBLE } from "@secux/transport-reactnative";
import { DeviceType } from '@secux/transport/lib/interface';
import "./mocha";


const TITLE = "Automation Testing";

export default function App() {
    const [title, SetTitle] = React.useState(TITLE);
    const [scanning, SetScanning] = React.useState(false);
    const [dialog, ShowDialog] = React.useState(false);
    const [otp, SetOTP] = React.useState();
    const [devices, SetDevices] = React.useState([]);
    const [transport, SetTransport] = React.useState();
    const [tests, SetTests] = React.useState([]);
    let total = 0;
    let idx = 0;
    let passed = 0;


    const AddDevice = (device) => {
        device.clicked = false;
        SetDevices(x => [...x, device]);
    };

    const DeleteDevice = (device) => {
        SetDevices(x => x.filter(item => item.id !== device.id));
    };

    const scan = () => {
        SecuxReactNativeBLE.StartScan(AddDevice, DeleteDevice, 2000, ["crypto", "nifty"]);
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

        if (device.DeviceType === DeviceType.crypto) {
            ShowDialog(true);
        }
    };

    const otp_processing = async () => {
        const success = await transport.SendOTP(otp);

        if (success) {
            ShowDialog(false);

            const runner = mocha.run();
            runner.removeAllListeners("end");
            runner.on("pass", (test) => {
                idx = idx + 1;
                SetTests((x) => {
                    const data = {
                        title: `[${idx}] ${test.fullTitle()}`,
                        passed: true
                    };

                    return [data, ...x];
                }, [test]);

                passed = passed + 1;
                SetTitle(`${TITLE} (${passed}/${total})`);
            });
            runner.on("fail", (test) => {
                idx = idx + 1;
                SetTests((x) => {
                    const data = {
                        title: `[${idx}] ${test.fullTitle()}`,
                        message: test.err?.message,
                        passed: false
                    };

                    return [data, ...x];
                }, [test]);
            });
            runner.on("suite", (suite) => {
                total = total + suite.tests.length;
                SetTitle(`${TITLE} (${passed}/${total})`);
            });

            require("./src/eth/test").test(GetDevice);
        }
    };

    const GetDevice = () => transport;

    return (
        <View style={styles.container}>
            <View style={{ flex: 1, alignItems: "center" }}>
                <Text>{title}</Text>
                <Button title="BLE Connect" onPress={scan} disabled={scanning} />
                <FlatList data={devices} renderItem={({ item }) => <Button style={styles.item} title={item.name} disabled={item.clicked} onPress={async () => { item.clicked = true; await connect(item.id); }} />} />
            </View>

            <View style={{ flex: 3, backgroundColor: "black" }}>
                <FlatList data={tests} renderItem={
                    ({ item }) => {
                        if (item.passed)
                            return <Text style={{ color: "white" }}>{item.title}</Text>
                        else
                            return <View>
                                <Text style={{ color: "red" }}>{item.title}</Text>
                                <Text style={{ color: "grey" }}>{item.message}</Text>
                            </View>
                    }
                }
                />
            </View>

            <View style={{ backgroundColor: "white" }}>
                <Dialog.Container visible={dialog}>
                    <Dialog.Title style={{ color: "black" }}>OTP Authentication</Dialog.Title>
                    <Dialog.Input style={{ color: "black" }} value={otp} onChangeText={SetOTP} />
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
