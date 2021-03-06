import { Injectable } from '@angular/core'; 
import { Geolocation } from '@ionic-native/geolocation';
import { Observable } from 'rxjs/Observable';

import * as math from 'mathjs';
import * as mapdata from '../assets/data/mapdata.json';

declare let google;

enum Roomcolor {
    blank = <any>"#777777",
    cafe = <any>"#BEE2E2",
    floor = <any>"#FFFFFF",
    lab = <any>"#0098A1",
    lib = <any>"#BEE2E2",
    lecture = <any>"#39B7BC",
    lift = <any>"#BEE2E2",
    mensa = <any>"#BEE2E2",
    office = <any>"#BBBBBB",
    service = <any>"#BEE2E2",
    staircase = <any>"#BEE2E2",
    wc = <any>"#BEE2E2",
    wcPrivate = <any>"#BBBBBB"
}

@Injectable()
export class MapService {  
    public googleKey = "AIzaSyCtPKTmtL83e8StfuawkBhXH74kgLcbNF0"; // TESTING

    constructor(private geolocation: Geolocation) {
    }     

    /**
     * Returns options for google map
     */
    public getMapOptions(position: any) {
        if (position == null) position = {lat: 52.545165, lng: 13.355360};
        return {
            //center: latlng,
            center: position,
            zoom: 18,
            mapTypeControl: false,
            fullscreenControl: false,
            streetViewControl: false,
            zoomControl: false,
            styles: mapdata.styles,
            mapTypeId: google.maps.MapTypeId.ROADMAP
            //mapTypeId: google.maps.MapTypeId.SATELLITE
        }
    }
    
    /**
     * Returns users position using gps
     */
    public getCurrentPositionGPS() {
        return Observable.create(observer => {
            let lat, lng;
            this.geolocation.getCurrentPosition({enableHighAccuracy:true}).then((position) => { 
                observer.next({lat: position.coords.latitude, lng: position.coords.longitude});
                observer.complete();
            }, (error) => {
                console.error("ERROR: " + error);
            });
        });        
    }

    /**
     * Returns custom maker with icon
     * @param type 
     * @param paths 
     */
    public getIconForCustomMarker(type: String, paths: any) {
        let roomCentroid = this.getPolygonCentroid(paths);
        let position = new google.maps.LatLng(parseFloat(roomCentroid.lat), parseFloat(roomCentroid.lng));      
        switch(type) { 
            case "lecture":
                let pathLecture = "./assets/icon/lecture.png";
                return this.createCustomMarker(position, pathLecture, 16);
            case "lab":
                let pathLab = "./assets/icon/lab.png";
                return this.createCustomMarker(position, pathLab, 16);
            case "wc":                                          
                let pathWc = "./assets/icon/wc.png";
                return this.createCustomMarker(position, pathWc, 16);
            case "staircase":                                          
                let pathStaircase = "./assets/icon/staircase.png";
                return this.createCustomMarker(position, pathStaircase, 16);
            case "lift":                                          
                let pathLift = "./assets/icon/lift.png";
                return this.createCustomMarker(position, pathLift, 16);
            case "cafe":                            
                let pathCafe = "./assets/icon/cafe.png";
                return this.createCustomMarker(position, pathCafe, 16);
            case "lib":
                let pathLib = "./assets/icon/lib.png";
                return this.createCustomMarker(position, pathLib, 16);               
            /* case "mensa":                                          
                let pathMensa = "./assets/icon/mensa.png";
                return this.mapService.createCustomMarker(position, pathMensa, 16);  */
            default:
                return;                            
        }
    }

    /**
     * Changes the current level of map data if not out of bounds
     * @param currentLevel 
     * @param buildingLevels 
     * @param direction 
     */
    public changeCurrentLevel(currentLevel: any, buildingLevels: any, newLevel: any) {
        if (newLevel > buildingLevels[0] - 1 && newLevel < buildingLevels[1] + 1) return newLevel;
        else return currentLevel;
    }

    // POLYGONS
    
    /**
     * Creates room polygon for current level
     * @param paths 
     * @param type 
     */
    public createPolygonRoomOptions(paths: any, type: any) {
        let polygon = new google.maps.Polygon({
            paths: paths,
            strokeColor: '#000000',
            strokeOpacity: 0.5,
            strokeWeight: 1,
            fillColor: Roomcolor[type],
            fillOpacity: 0.5,
            zIndex: 500
        })
        return polygon;
    }

    /**
     * Creates polygon for skipped buildings
     * @param paths 
     */
    public createPolygonBuildingOptions(paths: any) {
        let polygon = new google.maps.Polygon({
            paths: paths,
            strokeColor: '#000000',
            strokeOpacity: 1,
            strokeWeight: 1,
            fillColor: '#0098a1',
            fillOpacity: 0.5
        })
        return polygon;
    }
    
    /**
     * Creates invisible routing polygon for triangulation
     * @param paths 
     */
    public createRoutingPolygon(paths: any) {
        let routingPolygon = new google.maps.Polygon({
            paths: paths,
            strokeOpacity: 0,
            fillOpacity: 0
        });
        return routingPolygon;
    }
    
    /**
     * Returns polygon options for triangulation
     * @param paths 
     */
    public createTriangleOptions(paths: any,) {
        let PolygonOptions: any = {
            paths: paths,
            strokeColor: '#ffffff',
            strokeOpacity: 0.0,
            fillOpacity: 0
        }  
        return PolygonOptions;
    }

    // MARKERS

    public createPositionMarker(position: any, url: any, size: any) {        
        let icon = this.getCustomMarkerIcon(url, size);
        let customMarker = new google.maps.Marker({
            position: position,
            zIndex: 1100,
            icon: icon
        });
        return customMarker;
    }

    public createCustomMarker(position: any, url: any, size: any) {        
        let icon = this.getCustomMarkerIcon(url, size);
        let customMarker = new google.maps.Marker({
            position: position,
            zIndex: 800,
            icon: icon
        });
        return customMarker;
    }

    public createRouteMarker(position: any, url: any, size: any) {  
        let icon = this.getRouteMarkerIcon(url, size);
        let routeMarker = new google.maps.Marker({
            animation: google.maps.Animation.DROP,
            position: position,
            zIndex: 1000,
            icon: icon
        });
        return routeMarker;
    }

    public createRouteMarkerRemain(position: any, url: any, size: any) {        
        let icon = this.getRouteMarkerIcon(url, size);
        let routeMarker = new google.maps.Marker({
            animation: google.maps.Animation.DROP,
            position: position,
            zIndex: 950,
            opacity: 0.50,
            icon: icon
        });
        return routeMarker;
    }

    public getCustomMarkerIcon(url: any, size: any) {
        let icon = {
            url: url,
            scaledSize: new google.maps.Size(size, size),
            anchor: new google.maps.Point(size / 2, size / 2)
        }
        return icon;
    }

    public getRouteMarkerIcon(url: any, size: any) {
        let icon = {
            url: url,
            scaledSize: new google.maps.Size(size, size)
        }
        return icon;
    }    

    /**
     * Returns router marker size on specific zoom level
     * @param zoom 
     */
    public getRouteMarkerSize(zoom: any) {
        let zoomDiff = 18 - zoom;
        switch(true) {
            case (zoomDiff > 0): return 48 - (zoomDiff * 4);              
            case (zoomDiff < 0): return 48 + (zoomDiff / 4);    
            default: return 48;
        }     
    }

    /**
     * Returns custom marker size on specific zoom level
     * @param zoom 
     */
    public getCustomMarkerSize(zoom: any) {
        let zoomDiff = 18 - zoom;
        switch(true) {
            case (zoomDiff > 0):
                return 16 - (zoomDiff * 4);
                //return 16 / (Math.pow(2, Math.abs(zoomDiff)));                
            case (zoomDiff < 0):
                return 16 + (zoomDiff / 4);                
                //return 16 * (Math.pow(2, zoomDiff));
            default:
                return 16;
        }     
    } 

    // POLYLINES

    /**
     * Creates routing polyline for Google map
     * @param points
     */
    public createRoutePolyline(points: any) {
        let polyline = new google.maps.Polyline({
          path: points,
          geodesic: true,
          strokeColor: '#EE342E',
          strokeOpacity: 1.0,
          strokeWeight: 3,
          zIndex: 900
        })
        return polyline;
    }

    /**
     * Creates remaining routing polyline for Google map
     * @param points
     */
    public createRoutePolylineRemain(points: any) {
        let polyline = new google.maps.Polyline({
          path: points,
          geodesic: true,
          strokeColor: '#EE342E',
          strokeOpacity: 0.50,
          strokeWeight: 3,
          zIndex: 850
        })
        return polyline;
    }

    /**
     * Returns the altitude at specific position
     * @param lat 
     * @param lng 
     */
    public getElevation(lat, lng) {
        return Observable.create(observer => {
            let url = 'https://maps.googleapis.com/maps/api/elevation/json?locations=' + lat + ',' + lng + '&key=' + this.googleKey;
            fetch(url).then(res => res.json()).then((results) => {
                let jsonStr = JSON.stringify(results);
                let jsonSub = jsonStr.substring(25);
                let index = jsonSub.indexOf(",");
                observer.next(parseFloat(jsonSub.substring(0, index)).toFixed(2));
                observer.complete();
            }).catch(err => console.error(err));
        });
    }

    /**
     * Calculates the centroid of a polygon
     * @param points 
     */
    public getPolygonCentroid(points: any[]) {
        let centroid: any = {lat: 0, lng: 0};
        for (let x in points) {
            centroid.lat += points[x].lat;
            centroid.lng += points[x].lng;
        }
        centroid.lat = centroid.lat / points.length;
        centroid.lng = centroid.lng / points.length;
        return centroid;
    }

    /**
     * Splits full set of string polygon point coordinates to single point coordinates in array
     * @param points 
     */
    public splitCoordinatesToLatLng(points: any[]) {
        let paths: any[] = [];
        for (let x in points) {
            let latlngStr: any[] = points[x].split(", ");
            // String to number
            let lat = +latlngStr[0];
            let lng = +latlngStr[1];

            paths.push({lat: lat, lng: lng});
        }
        return paths;
    }   
}