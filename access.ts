//% weight=100 color=#1E90FF icon="\uf023" block="microSySTEM Access"
namespace microSystemAccess {
    // =========================
    // HARDWARE CONFIGURATION
    // =========================

    const DFR1216_I2C_ADDR = 0x33

    // DFR1216 C0 registers
    const C0_MODE_REGISTER = 0x2C
    const C0_WRITE_REGISTER = 0x39

    // DFR1216 digital output mode
    const DIGITAL_OUTPUT_MODE = 4

    // Door microswitch
    const DOOR_SWITCH_PIN = DigitalPin.P0

    // Grove capacitive keypad
    // Keypad RX connected to micro:bit P14
    // Keypad TX connected to micro:bit P15
    const KEYPAD_TX_PIN = SerialPin.P14
    const KEYPAD_RX_PIN = SerialPin.P15

    const KEYPAD_EVENT_ID = 3100

    let doorClosedLevel = 1

    let keypadInitialized = false
    let lastKey: AccessKey = AccessKey.None
    let lastEventKey: AccessKey = AccessKey.None
    let enteredCode = ""

    // =========================
    // DFR1216 LOW LEVEL FUNCTIONS
    // =========================

    function dfr1216WriteReg(reg: number, value: number): void {
        let buf = pins.createBuffer(2)
        buf[0] = reg
        buf[1] = value
        pins.i2cWriteBuffer(DFR1216_I2C_ADDR, buf)
    }

    function setC0DigitalOutput(): void {
        dfr1216WriteReg(C0_MODE_REGISTER, DIGITAL_OUTPUT_MODE)
    }

    function writeC0(value: number): void {
        setC0DigitalOutput()
        dfr1216WriteReg(C0_WRITE_REGISTER, value)
    }

    // =========================
    // DOOR LOCK
    // =========================

    /**
     * Locks the door using the magnetic lock connected to C0.
     */
    //% blockId=microSystemAccess_lockDoor
    //% block="lock door"
    //% group="Door lock"
    //% weight=100
    export function lockDoor(): void {
        writeC0(1)
    }

    /**
     * Unlocks the door using the magnetic lock connected to C0.
     */
    //% blockId=microSystemAccess_unlockDoor
    //% block="unlock door"
    //% group="Door lock"
    //% weight=90
    export function unlockDoor(): void {
        writeC0(0)
    }

    // =========================
    // DOOR SENSOR
    // =========================

    /**
     * Returns true if the door is in the selected state.
     */
    //% blockId=microSystemAccess_doorIs
    //% block="door is %state"
    //% group="Door sensor"
    //% weight=80
    export function doorIs(state: AccessDoorState): boolean {
        let value = pins.digitalReadPin(DOOR_SWITCH_PIN)
        let closed = value == doorClosedLevel

        if (state == AccessDoorState.Closed) {
            return closed
        } else {
            return !closed
        }
    }

    /**
     * Sets the electrical level read when the door is closed.
     * Use this if the microswitch logic is inverted.
     */
    //% blockId=microSystemAccess_setDoorClosedLevel
    //% block="set door closed level to %level"
    //% group="Door sensor"
    //% weight=70
    export function setDoorClosedLevel(level: AccessSwitchLevel): void {
        if (level == AccessSwitchLevel.High) {
            doorClosedLevel = 1
        } else {
            doorClosedLevel = 0
        }
    }

    // =========================
    // KEYPAD
    // =========================

    /**
     * Initializes the Grove capacitive keypad on P14/P15.
     */
    //% blockId=microSystemAccess_initKeypad
    //% block="initialize keypad"
    //% group="Keypad"
    //% weight=100
    export function initializeKeypad(): void {
        if (keypadInitialized) {
            return
        }

        keypadInitialized = true

        serial.redirect(
            KEYPAD_TX_PIN,
            KEYPAD_RX_PIN,
            BaudRate.BaudRate9600
        )

        basic.pause(100)

        control.inBackground(function () {
            while (true) {
                let buffer = serial.readBuffer(1)

                if (buffer && buffer.length > 0) {
                    let key = decodeKey(buffer[0])

                    if (key != AccessKey.None) {
                        lastKey = key
                        lastEventKey = key
                        addKeyToCode(key)
                        control.raiseEvent(KEYPAD_EVENT_ID, 1)
                    }
                }

                basic.pause(5)
            }
        })
    }

    /**
     * Returns true if a key has been received.
     */
    //% blockId=microSystemAccess_keyAvailable
    //% block="key available"
    //% group="Keypad"
    //% weight=90
    export function keyAvailable(): boolean {
        initializeKeypad()
        return lastKey != AccessKey.None
    }

    /**
     * Reads the last received key and clears it.
     */
    //% blockId=microSystemAccess_readKey
    //% block="read key"
    //% group="Keypad"
    //% weight=80
    export function readKey(): AccessKey {
        initializeKeypad()

        let key = lastKey
        lastKey = AccessKey.None

        return key
    }

    /**
     * Returns the last received key without clearing it.
     */
    //% blockId=microSystemAccess_lastKey
    //% block="last key"
    //% group="Keypad"
    //% weight=70
    export function lastKeyPressed(): AccessKey {
        initializeKeypad()
        return lastKey
    }

    /**
     * Waits until a key is pressed, then returns it.
     */
    //% blockId=microSystemAccess_waitForKey
    //% block="wait for key"
    //% group="Keypad"
    //% weight=60
    export function waitForKey(): AccessKey {
        initializeKeypad()

        while (lastKey == AccessKey.None) {
            basic.pause(20)
        }

        return readKey()
    }

    /**
     * Runs code when a keypad key is pressed.
     */
    //% blockId=microSystemAccess_onKeyPressed
    //% block="on keypad key pressed"
    //% group="Keypad"
    //% draggableParameters=reporter
    //% weight=50
    export function onKeyPressed(handler: (key: AccessKey) => void): void {
        initializeKeypad()

        control.onEvent(KEYPAD_EVENT_ID, 1, function () {
            handler(lastEventKey)
        })
    }

    // =========================
    // ACCESS CODE
    // =========================

    /**
     * Returns the current typed code as text.
     */
    //% blockId=microSystemAccess_enteredCode
    //% block="entered code"
    //% group="Access code"
    //% weight=80
    export function getEnteredCode(): string {
        initializeKeypad()
        return enteredCode
    }

    /**
     * Clears the current typed code.
     */
    //% blockId=microSystemAccess_clearEnteredCode
    //% block="clear entered code"
    //% group="Access code"
    //% weight=70
    export function clearEnteredCode(): void {
        enteredCode = ""
        lastKey = AccessKey.None
    }

    /**
     * Returns true if the entered code matches the given code.
     */
    //% blockId=microSystemAccess_enteredCodeIs
    //% block="entered code is %code"
    //% group="Access code"
    //% weight=60
    export function enteredCodeIs(code: string): boolean {
        initializeKeypad()
        return enteredCode == code
    }

    /**
     * Removes the last character from the entered code.
     */
    //% blockId=microSystemAccess_deleteLastCharacter
    //% block="delete last character"
    //% group="Access code"
    //% weight=50
    export function deleteLastCharacter(): void {
        if (enteredCode.length > 0) {
            enteredCode = enteredCode.substr(0, enteredCode.length - 1)
        }
    }

    // =========================
    // INTERNAL KEYPAD FUNCTIONS
    // =========================

    function decodeKey(data: number): AccessKey {
        switch (data) {
            case 0xE1: return AccessKey.Num1
            case 0xE2: return AccessKey.Num2
            case 0xE3: return AccessKey.Num3
            case 0xE4: return AccessKey.Num4
            case 0xE5: return AccessKey.Num5
            case 0xE6: return AccessKey.Num6
            case 0xE7: return AccessKey.Num7
            case 0xE8: return AccessKey.Num8
            case 0xE9: return AccessKey.Num9
            case 0xEA: return AccessKey.Star
            case 0xEB: return AccessKey.Num0
            case 0xEC: return AccessKey.Hash
            default: return AccessKey.None
        }
    }

    function addKeyToCode(key: AccessKey): void {
        if (key == AccessKey.Star) {
            enteredCode = ""
        } else if (key == AccessKey.Hash) {
            // Hash is used as validation key.
            // It is not added to the entered code.
        } else if (key >= AccessKey.Num0 && key <= AccessKey.Num9) {
            if (enteredCode.length < 16) {
                enteredCode = enteredCode + keyToText(key)
            }
        }
    }

    function keyToText(key: AccessKey): string {
        switch (key) {
            case AccessKey.Num0: return "0"
            case AccessKey.Num1: return "1"
            case AccessKey.Num2: return "2"
            case AccessKey.Num3: return "3"
            case AccessKey.Num4: return "4"
            case AccessKey.Num5: return "5"
            case AccessKey.Num6: return "6"
            case AccessKey.Num7: return "7"
            case AccessKey.Num8: return "8"
            case AccessKey.Num9: return "9"
            case AccessKey.Star: return "*"
            case AccessKey.Hash: return "#"
            default: return ""
        }
    }
}
