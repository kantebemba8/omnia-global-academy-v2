package com.omniaglobalacademy.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.omniaglobalacademy.app.billing.OmniaStorePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(OmniaStorePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
