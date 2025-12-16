import sys
from inputs import devices
from inputs import get_gamepad
from inputs import get_key
from inputs import get_mouse


def capture_controller_data():
    try:
        while True:
            events = get_gamepad() # Captures gamepad events
            for event in events:
                #print(f"Event: {event.ev_type}, Code: {event.code}, State: {event.state}")
                send_stdout_event(event)
    except KeyboardInterrupt:
        print("\nExiting...")
        exit()

def capture_keyboard_data():
    try:
        while True:
            events = get_key()  # Captures keyboard events
            for event in events:
                #print(f"Event: {event.ev_type}, Code: {event.code}, State: {event.state}")
                send_stdout_event(event)
    except KeyboardInterrupt:
        print("\nExiting...")
        exit()

def capture_mouse_data():
    try:
        while True:
            print("Fetching events")
            events = get_mouse()  # Captures keyboard events
            print("Fetched events")
            for event in events:
                #print(f"Event: {event.ev_type}, Code: {event.code}, State: {event.state}")
                send_stdout_event(event)
    except KeyboardInterrupt:
        print("\nExiting...")
        exit()


def send_stdout_event(event):
    if(event.ev_type!="Sync"):
        print(f"Type: {event.ev_type}, Code: {event.code}, Value: {event.state}")



if __name__ == '__main__':
    print("# DEVICE INPUT ADAPTER STARTED")
    print("Connected devices:")
    for device in devices:
        print(device)
    script_name = sys.argv[0]
    args = sys.argv[1:]
    device_to_capture= args[0]

    if device_to_capture=="keyboard":
        print("Capturing data from keyboard")
        capture_keyboard_data()
    elif device_to_capture=="controller":
        print("Capturing data from controller")
        capture_controller_data()
    elif device_to_capture=="mouse":
        print("Capturing data from mouse")
        capture_mouse_data()
    else:
        print("Unknown device type: "+device_to_capture+", exiting...")