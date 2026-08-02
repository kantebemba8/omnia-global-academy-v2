import UIKit
import Capacitor

class OmniaBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(OmniaStorePlugin())
    }
}
