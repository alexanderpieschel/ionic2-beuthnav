import { Component, ViewChild, ElementRef } from '@angular/core';
import { NavController, Platform } from 'ionic-angular';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { trigger, state, transition, style, animate } from '@angular/animations';
import { Geolocation } from '@ionic-native/geolocation';
import { Http } from '@angular/http';

import { BeaconService } from '../../services/beaconservice';
import { DatabaseService } from '../../services/databaseservice';
import { IntersectService } from '../../services/intersectservice';
import { KalmanService } from '../../services/kalmanservice';
import { MapService } from '../../services/mapservice';
import { MotionService } from '../../services/motionservice';
import { RoutingService } from '../../services/routingservice';

declare let google;

@Component({
  selector: 'page-home',
  templateUrl: 'home.html',
  providers: [DatabaseService],
  animations: [
        trigger('listViewInOut', [
            state("in", style({
                transform: 'translate3d(0, 0%, 0)'
            })),
            state('out', style({
                transform: 'translate3d(0, 100%, 0)'
            })),
            transition('in => out', animate('100ms ease-in')),
            transition('out => in', animate('100ms ease-out'))
        ]),
        trigger('infoViewInOut', [
            state("in", style({
                transform: 'translate3d(0, 0%, 0)'
            })),
            state('out', style({
                transform: 'translate3d(0, 100%, 0)'
            })),
            transition('in => out', animate('100ms ease-in')),
            transition('out => in', animate('100ms ease-out'))
        ]),
        trigger('levelViewInOut', [
            state("in", style({
                transform: 'translate3d(0, 100%, 0)'
            })),
            state('out', style({
                transform: 'translate3d(0, 80%, 0)'
            })),
            transition('in => out', animate('100ms ease-in')),
            transition('out => in', animate('100ms ease-out'))
        ]),
    ]
})

export class HomePage {

    @ViewChild('map') mapelement: ElementRef;
    map: any;

    // states
    public startState = 0;
    public listViewState = 'out';
    public infoViewState = 'out';
    public levelViewState = 'in'
    public mapViewState = 'on'

    // room data
    public roomsListView: any[] = [];
    public roomsListViewBackup: any[] = [];
    public allPoints: any[] = [];
    public attributes = {name: "", type: "", desc: "", position: ""};

    // map elements
    public polygons: any[] = [];
    public polygonsRouting: any[] = [];
    public customMarkers: any[] = [];
    public infoWindows: any[] = [];
    public marker;
    public polygon;
    public circle; 

    // beacon variables
    public beacons: any[] = [];
    public tricons: any[] = [];
    public triconsACC: any[] = [];
    
    // location variables
    public previousBuilding;
    public previousLevel;
    public currentPosition = null;
    public currentBuilding = "";    
    public currentLevel = 0;
    public currentAttr;
    public currentCoords;
    public currentPoints;

    // logging
    public checkLog;

    // step detection test
    public motionStatus = 0;
    public x = 0;
    public y = 0;
    public z = 0;
    public accValueLowPass;
    public steps = 0;
    public direction;
    public directionValues: any[] = [];
    public compassPts: any[] = [];
    public centroidPts: any[] = [];
    public polylineIndex = 6;   

    constructor(public navCtrl: NavController,
                public platform: Platform,
                public geolocation: Geolocation,
                public beaconService: BeaconService,                
                public dbService: DatabaseService,
                public intersectService: IntersectService,
                public mapService: MapService,
                public motionService: MotionService,
                public routingService: RoutingService) {    
        this.initializeRoomListView();        
    }

    ionViewDidLoad() {
        this.platform.ready().then(() => {   
            this.beaconService.setupBeacons();
            this.beaconService.startRangingBeacons();

            // Interval positioning from available methods
            setInterval(() => { 
                this.checkLog = "";
                this.checkBeacons();
                if (this.mapViewState == 'on') {
                    this.getCurrentPosition();
                }                
             }, 3000);

            // Initialize DeviceOrientation
            if ((<any>window).DeviceOrientationEvent) {
                console.log("DeviceOrientationevent available");
                window.addEventListener('deviceorientation', (eventData) => {
                    //var dir = eventData.alpha
                    //deviceOrientationHandler(dir);
                    //this.direction = 360 - Math.ceil(dir);
                    let dir = 360 - Math.ceil(eventData.alpha);
                    if (this.directionValues.length < 11) {
                        this.directionValues.push(dir);
                        //this.direction = this.motionService.getMedian(this.directionValues);
                    } else {
                        this.directionValues.splice(0, 1);
                        this.directionValues.push(dir);
                        //this.direction = this.motionService.getMedian(this.directionValues);
                    }        
                    if (this.directionValues.length > 0)             {
                        let kalman = new KalmanService();
                        let dataConstantKalman = this.directionValues.map(function(v) {
                            return kalman.filter(v, 4, 10, 1, 0, 1);
                        });
                        let index = dataConstantKalman.length - 1;
                        //console.log("Constant Kalman[length]: " + dataConstantKalman.length + ", " + dataConstantKalman[index]);
                        this.direction = dataConstantKalman[index];
                    }
                    //console.log("Dir: " + this.direction);
                }, false);
            } else {
                console.log("No DeviceOrientationEvent available");
            };            
        });
    }

    // UI
    public toggleListView() {
        this.listViewState = (this.listViewState == 'out') ? 'in' : 'out';
        console.log("ListViewState: " + this.listViewState);
    }

    public toggleInfoView() {
        this.infoViewState = (this.infoViewState == 'out') ? 'in' : 'out';
        console.log("InfoViewState: " + this.infoViewState);
    }

    public toggleMapView() {
        this.mapViewState = (this.mapViewState == 'on') ? 'off' : 'on';
        console.log("MapViewState: " + this.mapViewState);        
    }

    public initializeRoomListView() {  
        console.log("Initialize ListView.")  
        this.dbService.getRoomsListView().subscribe(data => {
            this.roomsListView = data;
            this.roomsListViewBackup = this.roomsListView;
            console.log("ListView loaded: " + this.roomsListViewBackup.length);
        });
        
    }

    /**
     * Loads polygon data on google map
     * @param floor 
     */
    public loadMap() { 
        console.log("Load map styles.");

        this.map = new google.maps.Map(this.mapelement.nativeElement, this.mapService.getMapOptions());

        // Zoom changed listener
        google.maps.event.addListener(this.map, 'zoom_changed', () => {
            if (this.circle != null) this.circle.setRadius(this.mapService.getCircleRadius(this.getMapZoom()));      
            if (this.marker != null) this.marker.setIcon(this.mapService.getCustomMarkerIcon(this.marker.getIcon().url, this.mapService.getRouteMarkerSize(this.getMapZoom())));
            for (let x in this.customMarkers) {                    
                this.customMarkers[x].setIcon(this.mapService.getCustomMarkerIcon(this.customMarkers[x].getIcon().url, this.mapService.getCustomMarkerSize(this.getMapZoom())));
            }
        });

        google.maps.event.addListener(this.map, 'click', (event) => {
            console.log("Click on map: " + event.latLng);
        })

        // reset map elements
        if (this.polygons != null) {
            for (let x in this.polygons) this.polygons[x].setMap(null);
            this.polygons = [];
        }
        if (this.polygonsRouting != null) {
            for (let x in this.polygonsRouting) this.polygonsRouting[x].polygon.setMap(null);
            this.polygonsRouting = [];
        }
        if (this.customMarkers != null) {
            for (let x in this.customMarkers) this.customMarkers[x].setMap(null);
            this.customMarkers = [];
        }

        if (this.currentAttr != null && this.currentLevel != null) {   
            // SQLite Code with Observable    
            this.dbService.getCurrentAttrCoords(this.currentAttr, this.currentCoords).subscribe(data => {
                console.log("Loading map polygons.");
                for (let x in data) {
                    let room: any = {};
                    let paths: any[] = [];

                    room = data[x];

                    let allCoordinates = room.coordinates;
                    let coordinates: String[] = allCoordinates.split("; ");

                    // split all coordinates to LatLng paths
                    paths = this.mapService.splitCoordinatesToLatLng(coordinates);                    

                    let polygon = new google.maps.Polygon();
                    polygon.setOptions(this.mapService.createPolygonRoomOptions(paths, room.type));
                    polygon.setMap(this.map);

                    this.polygons.push(polygon);

                    if (room.routing == "true") this.polygonsRouting.push({shapeid: room.shapeid, name: room.name, polygon: polygon})

                    if (room.type == "lab" || room.type == "lecture" || room.type == "office" || room.type == "service" || room.type == "mensa") {
                        google.maps.event.addListener(polygon, 'click', (event) => {
                            let attributes = {shapeid: room.shapeid, name: room.name, desc: room.desc, building: this.currentBuilding, level: this.currentLevel};
                            this.selectRoom(attributes);
                        })
                    }

                    if (room.type == "wc" || room.type == "staircase" || room.type == "lift" || room.type == "cafe" || room.type == "lib") {
                        let roomCentroid = this.mapService.getPolygonCentroid(paths);
                        let position = new google.maps.LatLng(parseFloat(roomCentroid.lat), parseFloat(roomCentroid.lng));   
                        let customMarker = this.mapService.getIconForCustomMarker(room.type, paths);
                        customMarker.setMap(this.map);
                        this.customMarkers.push(customMarker); 
                        google.maps.event.addListener(customMarker, 'click', (event) => {
                            let attributes = {shapeid: room.shapeid, name: room.name, desc: room.desc, building: this.currentBuilding, level: this.currentLevel};
                            this.selectRoom(attributes);
                        })
                    }                    
                }   
                console.log("Polygons loaded: " + this.polygons.length + ", Custom markers: " + this.customMarkers.length);
            })  

            this.dbService.getAllBuildingsAttrCoords(this.currentBuilding).subscribe(data => {
                console.log("Loading map buildings.");

                if (this.infoWindows != null) {
                    for (let x in this.infoWindows) this.infoWindows[x].setMap(null);
                    this.infoWindows = [];
                }

                let building: any = {};
                
                for (let x in data) {
                    let paths: any[] = [];

                    building = data[x];

                    let allCoordinates = building.coordinates;
                    let coordinates: String[] = allCoordinates.split(";");

                    paths = this.mapService.splitCoordinatesToLatLng(coordinates);
                    

                    let polygon = new google.maps.Polygon();
                    polygon.setOptions(this.mapService.createPolygonBuildingOptions(paths));
                    polygon.setMap(this.map);

                    /* google.maps.event.addListener(polygon, 'click', (event) => {

                    }) */

                    let centroid = this.mapService.getPolygonCentroid(paths);
                    let infoWindow = this.mapService.createInfoWindow(centroid, building.name);
                    infoWindow.setMap(this.map);
                    infoWindow.open;
                    this.infoWindows.push(infoWindow);  
                }

                // replace with centroid of currentBuilding
                /* let center = this.map.getCenter();
                center = new google.maps.LatLng(52.545165, 13.355360);
                this.map.panTo(center); */
            })
        }
    }   

    /**
     * Retrieves current position from beacons or gps
     */
    public getCurrentPosition() {        
        this.checkLog += "Position-"        
        if (this.beacons.length > 2) {
            this.currentPosition = this.getCurrentPositionBeacons(); 
            this.displayCurrentPosition();
            if (this.currentPosition != null) this.getCurrentBuilding();    
            console.log(this.checkLog);              
        } else {
            this.mapService.getCurrentPositionGPS().subscribe(data => {
                this.currentPosition = data;
                this.checkLog += "GPS: " + this.currentPosition.lat + ", " + this.currentPosition.lng;
                this.displayCurrentPosition();
                if (this.currentPosition != null) this.getCurrentBuilding();
                console.log(this.checkLog);
            });            
        }
    }

    /**
     * Sets current position from gps
     */
    public getCurrentPositionGPS() {
        this.checkLog += "GPS: "
        this.geolocation.getCurrentPosition({timeout: 5000, enableHighAccuracy:true}).then((position) => {    
            this.checkLog += position.coords.latitude + ", " + position.coords.longitude;
            return {lat: position.coords.latitude, lng: position.coords.longitude}
        }, (error) => {
            console.log(error);
            this.checkLog += "ERROR: " + error;
        });
    }     
    
    /**
     * Updates display of current user position
     */
    public displayCurrentPosition() {
        if (this.map != null) {
            let center = new google.maps.LatLng(this.currentPosition.lat, this.currentPosition.lng);
            if (this.circle != null) {
                this.circle.setMap(null);
            }  
            this.circle = new google.maps.Circle();
            this.circle.setOptions(this.mapService.createCircleOptions(this.currentPosition, (this.mapService.getCircleRadius(this.getMapZoom()).toFixed(4))));
            this.circle.setMap(this.map);
            // if viewStates not on
            //this.map.panTo(center); ####### ENABLE IN SCHOOL
        }
    }

    /**
     * Checks for the current displayed building by current user position
     */
    public getCurrentBuilding() {
        this.previousBuilding = this.currentBuilding;
        let buildings = this.dbService.getBuildingsCentroids();
        let currentPositionLatLng = new google.maps.LatLng(this.currentPosition.lat, this.currentPosition.lng);
        try {
            let buildingsSort = this.routingService.sortByDistance(buildings, currentPositionLatLng);
            this.currentBuilding = buildingsSort[0].name;
            this.checkLog += ", Current Building: " + this.currentBuilding;
        } catch (e) {
            console.log("Get current building, ERROR: " + e);
            this.currentBuilding = "BauwesenD";
        }

        if (this.currentBuilding != this.previousBuilding || this.currentLevel != this.previousLevel) {
            let tables = this.dbService.getCurrentBuildingTables(this.currentBuilding, this.currentLevel);
            this.currentAttr = tables.attr;
            this.currentCoords = tables.coords;
            this.currentPoints = tables.points;
            this.loadMap();    
            this.startState = 1;   
            this.dbService.getCurrentPoints(this.currentPoints).subscribe(data => {
                this.allPoints = data;   
            });   
        }
        this.previousLevel = this.currentLevel;
    }

    /**
     * Changes the current level on google map
     * @param direction 
     */
    public changeCurrentLevel(building: any, direction: any) {
        let buildingLevels = this.dbService.getBuildingLevels(this.currentBuilding);
        this.currentLevel = this.mapService.changeCurrentLevel(this.currentLevel, buildingLevels, direction);
        this.getCurrentBuilding();
    }

    /**
     * Returns current zoom of google map
     */
    public getMapZoom() {
        return this.map.getZoom();
    }

    /**
     * Filters ListView of all rooms
     * @param event 
     */
    public getRoomListView(event: any) {
        if (this.infoViewState == 'in') {
                this.toggleInfoView();
        }   
        this.roomsListView = this.roomsListViewBackup;

        let value = event.target.value;

        if (value && value.trim() != '') {    
            this.roomsListView = this.roomsListView.filter((room) => {
                return (room.name.toLowerCase().indexOf(value.toLowerCase()) > -1 || room.desc.toLowerCase().indexOf(value.toLowerCase()) > -1);
            })
            if (this.listViewState == 'out') {
                this.toggleListView();
            }
        } else {
            if (this.listViewState == 'in') {
                this.toggleListView();
            }
        }      
    }

    /**
     * Returns room attributes by shape id
     * @param shapeid 
     */
    public getAttributesByShapeId(shapeid: any) {
        this.dbService.getAttributesByShapeId(this.currentBuilding, shapeid).subscribe(data => {
            return data;
        })
    }

    /**
     * Selects room for routing and creates route marker
     * @param room 
     */
    public selectRoom(room: any) {
        this.dbService.getRoomCoordinates(room.shapeid, room.building, room.level).subscribe(data => {
            let roomCentroid = this.mapService.getPolygonCentroid(data);
            let position = new google.maps.LatLng(parseFloat(roomCentroid.lat), parseFloat(roomCentroid.lng));  

            this.attributes.name = room.name;
            this.attributes.desc = room.desc;

            if (this.marker != null) {
                this.marker.setMap(null);
            }
            
            this.marker = this.mapService.createRouteMarker(position, "./assets/icon/marker.png", 48);
            this.marker.setMap(this.map);
            this.map.panTo(position);

            if (this.listViewState == 'in') this.toggleListView();
            if (this.infoViewState == 'out') this.toggleInfoView();
        });  
    }    

    // ################# //
    // #### BEACONS #### //
    // ################# //
    public checkBeacons() {
        
        try {
            this.beacons = this.beaconService.getBeacons();
            /*for (let x in this.beacons) {
                str += this.beacons[x].identifier + ", ";
            }*/
            this.checkLog += "Beacons available: " + this.beacons.length + ", ";
            //console.log(str);
            //this.beaconService.getBeaconsC();
        } catch(e) {
            console.log(e);
        }
    }

    /**
     * Starts to search for beacons in range
     */
    public startRangingBeacons() {
        this.beaconService.startRangingBeacons();  
    }

    /**
     * Sets current position from beacons
     */
    public getCurrentPositionBeacons() {
        //console.log("CURRENT Positon Beacons.")
        this.tricons = [];
        this.triconsACC = [];        
        for (let i = 0; i < 3; i++) {
            let elevation;
            //console.log("B - " + i + ": " + beacons[i].identifier + "; " + beacons[i].coordinates + "; " + beacons[i].accCK);
            let latLngAlt = this.beacons[i].coordinates.split(", ");                
            this.tricons.push({lat: latLngAlt[0], lng: latLngAlt[1], distance: this.beacons[i].accCK, elevation: latLngAlt[2]});
            this.triconsACC.push({lat: latLngAlt[0], lng: latLngAlt[1], distance: this.beacons[i].acc, elevation: latLngAlt[2]});
            //console.log("T - " + i + ": " + this.tricons[i].lat + ", " + this.tricons[i].lng + ", " + this.tricons[i].distance + ", " + this.tricons[i].height);                
        }    
        let triPoint: any = this.mapService.trilaterate(this.tricons);
        //console.log("Beacon Tri Position: " + triStr);
        //let triStrACC: any = this.mapService.trilaterate(this.triconsACC);
        //console.log("Beacon Tri Position ACC: " + triStrACC);
        this.checkLog += "Beacons: " + triPoint.lat + ", " + triPoint.lng;
        //let splitTriPt = triPoint.split(", ");
        return {lat: triPoint.lat, lng: triPoint.lng};        
    }

    // ################ //
    // #### MOTION #### //
    // ################ //
    public routingMotion() {
        this.toggleMapView();
        console.log("Start motion routing.");
        let startPosition;
        this.mapService.getCurrentPositionGPS().subscribe(data => {
            startPosition = data;
            console.log("Start Position: " + startPosition.lat + ", " + startPosition.lng);
            this.startRoutingMotion(startPosition);
        });    
    }

    public startRoutingMotion(startPosition) {
        this.compassPts = [];
        this.currentPosition = startPosition.lat + ", " + startPosition.lng;
        this.compassPts.push(this.currentPosition);

        if (this.motionStatus === 0) {
            this.motionStatus = 1;
            this.motionService.startWatchingAcceleration().subscribe(data => {    
                this.x = data.x;
                this.y = data.y;
                this.z = data.z;
                this.accValueLowPass = this.motionService.accelerationLowPass(this.x, this.y, this.z);      
                let prevSteps = this.steps;     
                this.steps = this.motionService.stepDetection(this.accValueLowPass);  
                if (prevSteps < this.steps) {
                    this.currentPosition = this.mapService.getCurrentPositionCompass(this.currentPosition, 0.63, this.direction);
                    let currentPt = this.currentPosition.split(", ");
                    this.centroidPts.push({lat: currentPt[0], lng: currentPt[1]});
                    console.log("STEPS: " + this.steps);
                    // add centroid point of last 5 measured points to polyline, reset array
                    if (this.polylineIndex > 5) {
                        let centroidPt = this.mapService.getPolygonCentroid(this.centroidPts);
                        this.compassPts.push(this.currentPosition);
                        this.polylineIndex = 0;
                        this.centroidPts = [];
                    }
                    console.log("CompassPts Length: " + this.compassPts.length);
                    this.paintRoute(this.compassPts);
                    this.polylineIndex++;
                }
            });
        } else {
            this.motionService.stopWatchingAcceleration();
            this.motionStatus = 0;
        }
    }

    public paintRoute(points: any) {
        if (this.polygon != null) {
            this.polygon.setMap(null);
        }  
        if (this.mapViewState == 'on') {
            this.toggleMapView();
        }
        let latLngPts = this.mapService.splitCoordinatesToLatLng(points);
        this.polygon = new google.maps.Polyline();
        this.polygon.setOptions(this.mapService.createPolylineOptions(latLngPts));
        this.polygon.setMap(this.map);
        let center = new google.maps.LatLng(latLngPts[latLngPts.length-1].lat, latLngPts[latLngPts.length-1].lng);
        this.map.panTo(center);

        let lengthInMeters = google.maps.geometry.spherical.computeLength(this.polygon.getPath());
        console.log("Polyline length: " + lengthInMeters);
    }



    // ######################### \\
    // ######## ROUTING ######## \\
    // ######################### \\
    public testRouting() {
        
        let currentPosition = this.currentPosition;
        // let currentPosition = {lng: 13.35537, lat: 52.54572}; // oben rechts
        //let currentPosition = {lng: 13.35417, lat: 52.54486};  // unten links 1. og
        let currentPositionLatLng = new google.maps.LatLng(currentPosition.lat, currentPosition.lng);
        let routeInCurrentLevelStart, routeInCurrentLevelEnd;
        let rPaths; // paths for routing polyline

        for (let x in this.polygonsRouting) {
            if (this.routingService.containsLocation(currentPositionLatLng, this.polygonsRouting[x].polygon)) {
                routeInCurrentLevelStart = currentPosition;
                break;
            } else {
                let currentStartDistances = this.routingService.sortByDistance(this.allPoints, currentPositionLatLng);                                    
                // nearest route point = start
                routeInCurrentLevelStart = {lat: parseFloat(currentStartDistances[0].lat), lng: parseFloat(currentStartDistances[0].lng)};
            }
        }   

        // ###### temporary
        // let endName = "D 110";
        let endName = "D 121";
        let endBuilding = "BauwesenD"
        let endLevel = 1;
        let tempName;
        // ################

       /*  for (let x in this.allPoints) {

        } */
        //  if (this.allPoints[x].name.includes("CN")) {

        // routing through multiple levels
        if (endBuilding == this.currentBuilding && endLevel == this.currentLevel) {
            console.log("0: endBuilding: " + endBuilding + " == this.currentBuilding: " + this.currentBuilding + " && endLevel: " + endLevel + " == this.currentLevel: " + this.currentLevel);
            for (let x in this.allPoints) {
                if (this.allPoints[x].name.includes(endName)) {
                    routeInCurrentLevelEnd = {lat: parseFloat(this.allPoints[x].lat), lng: parseFloat(this.allPoints[x].lng)};
                    break;
                }
            }            
            //startPosition: any, endPosition: any,  routingEndName: String, routingPolygons: any,routingPoints: any,   tablePoints: any) {
            rPaths = this.routingService.createRouteInLevel(routeInCurrentLevelStart, routeInCurrentLevelEnd, this.polygonsRouting, this.allPoints); 
            let polyline = this.mapService.createPolyline(rPaths);                
            polyline.setMap(this.map);

        } else if (endBuilding == this.currentBuilding && endLevel != this.currentLevel) {
            console.log("1: endBuilding: " + endBuilding + " == this.currentBuilding: " + this.currentBuilding + " && endLevel: " + endLevel + " != this.currentLevel: " + this.currentLevel);
            // nearest lift / stairs
            let stairs: any[] = [];
            for (let x in this.allPoints) {
                if (this.allPoints[x].type == "staircase") stairs.push(this.allPoints[x]);
            }
            let stairsDistances = this.routingService.sortByDistance(stairs, currentPositionLatLng);            
            routeInCurrentLevelEnd = {lat: parseFloat(stairsDistances[0].lat), lng: parseFloat(stairsDistances[0].lng)};            

            rPaths = this.routingService.createRouteInLevel(routeInCurrentLevelStart, routeInCurrentLevelEnd, this.polygonsRouting, this.allPoints);               
            let polyline = this.mapService.createPolyline(rPaths);                
            polyline.setMap(this.map);

            // if tempEnd distance to currentPosition is < 1m getCurrentBuilding(currentBuilding, endLevel);

        } else if (endBuilding != this.currentBuilding) {
            console.log("2: endBuilding: " + endBuilding + " != this.currentBuilding: " + this.currentBuilding);
            if (this.currentLevel != 0) {
                console.log("2.1: this.currentLevel: + " + this.currentLevel + " != 0");
                let lifts: any[] = [];
                for (let x in this.allPoints) {
                    if (this.allPoints[x].type == "lift") lifts.push(this.allPoints[x]);
                }
                let liftsDistances = this.routingService.sortByDistance(lifts, currentPositionLatLng);            
                routeInCurrentLevelEnd = {lat: parseFloat(liftsDistances[0].lat), lng: parseFloat(liftsDistances[0].lng)};

                rPaths = this.routingService.createRouteInLevel(routeInCurrentLevelStart, routeInCurrentLevelEnd, this.polygonsRouting, this.allPoints);               
                let polyline = this.mapService.createPolyline(rPaths);                
                polyline.setMap(this.map);

                // if tempEnd distance to currentPosition is < 1m getCurrentBuilding(currentBuilding, level 0);
                // set nearest neighbor (shortest distance) of (new loaded) allPoints
                // route to exit in same level

            } else {
                console.log("2.2: this.currentLevel == 0");
                let exits: any[] = [];
                for (let x in this.allPoints) {
                    if (this.allPoints[x].type == "exit") exits.push(this.allPoints[x]);
                }
                let exitsDistances = this.routingService.sortByDistance(exits, currentPositionLatLng);            
                routeInCurrentLevelEnd = {lat: parseFloat(exitsDistances[0].lat), lng: parseFloat(exitsDistances[0].lng)};

                rPaths = this.routingService.createRouteInLevel(routeInCurrentLevelStart, routeInCurrentLevelEnd, this.polygonsRouting, this.allPoints);               
                let polyline = this.mapService.createPolyline(rPaths);                
                polyline.setMap(this.map);

                // route to exit in same level
            }   
        }             
    }        

    public testGS() {

    }
}