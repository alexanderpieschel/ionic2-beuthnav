import { BrowserModule } from '@angular/platform-browser';
import { ErrorHandler, NgModule } from '@angular/core';
import { IonicApp, IonicErrorHandler, IonicModule } from 'ionic-angular';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { MyApp } from './app.component';
import { HomePage } from '../pages/home/home';
import { DatabasePage } from '../pages/database/database';
import { ListPage } from '../pages/list/list';
import { HotSpotPage } from '../pages/hotspot/hotspot';
import { BeaconPage } from '../pages/beacon/beacon';
import { MotionPage } from '../pages/motion/motion';
import { TestPage } from '../pages/test/test';

import { StatusBar } from '@ionic-native/status-bar';
import { SplashScreen } from '@ionic-native/splash-screen';
import { DeviceMotion, DeviceMotionAccelerationData } from '@ionic-native/device-motion';
import { DeviceOrientation, DeviceOrientationCompassHeading } from '@ionic-native/device-orientation';
import { File } from '@ionic-native/file';
import { Geolocation } from '@ionic-native/geolocation';
import { SQLite, SQLiteObject } from '@ionic-native/sqlite';
import { IBeacon } from '@ionic-native/ibeacon';
import { Keyboard } from '@ionic-native/keyboard';

import { BeaconService } from '../services/beaconservice';
import { DatabaseService } from '../services/databaseservice';
import { FileService } from '../services/fileservice';
import { KalmanService } from '../services/kalmanservice';
import { MapService } from '../services/mapservice';
import { MotionService } from '../services/motionservice';
import { RoutingService } from '../services/routingservice';

@NgModule({
  declarations: [
    MyApp,
    HomePage,
    DatabasePage,
    ListPage,
    HotSpotPage,
    BeaconPage,
    MotionPage,
    TestPage
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    IonicModule.forRoot(MyApp, {
      scrollAssist: false,
      autoFocusAssist: false
    }),
  ],
  bootstrap: [IonicApp],
  entryComponents: [
    MyApp,
    HomePage,
    ListPage,
    DatabasePage,
    HotSpotPage,
    BeaconPage,
    MotionPage,
    TestPage
  ],
  providers: [
    StatusBar,
    SplashScreen,
    DeviceMotion,
    DeviceOrientation,
    File,
    Geolocation,
    IBeacon,
    Keyboard,
    SQLite,        
    BeaconService,
    DatabaseService,
    FileService,
    KalmanService,
    MapService,
    MotionService,
    RoutingService,
    {provide: ErrorHandler, useClass: IonicErrorHandler}
  ]
})
export class AppModule {}
