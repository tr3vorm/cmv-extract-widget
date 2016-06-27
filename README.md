cmv-extract-widget
==================

CMV widget to clip and ship a layer using a geoprocessing tool. This widget is based on the original CMV print widget, and created to provide a basic 'clip and ship' service. 

![screendump](https://github.com/tr3vorm/tr3vorm.github.io/blob/master/extract-screen.JPG)
Configuration viewer.config
-------------
```javascript
extract: {
  include: true,
  id: 'extract',
  type: 'titlePane',
  canFloat: true,
  path: 'gis/dijit/Extract',
  title: 'Export',
  open: false,
  position: 12,
  options: {
    map: true,
    extractTaskURL: 'http://sampleserver4.arcgisonline.com/ArcGIS/rest/services/HomelandSecurity/Incident_Data_Extraction/GPServer/Extract%20Data%20Task',
    defaultFeatureFormat: 'Shapefile - SHP - .shp',
    defaultRasterFormat: 'Tagged Image File Format - TIFF - .tif',
    defaultLayers: [' Incident Points']
  }
}
```
Usage
-----
1. Zoom to an area of interest. The current extents are used for clipping.
2. Select the out file format.
3. Select the layer to be exported. 

