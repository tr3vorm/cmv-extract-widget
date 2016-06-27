define([
    'dojo/_base/declare',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/_WidgetsInTemplateMixin',
    'esri/tasks/Geoprocessor',
    'esri/tasks/FeatureSet',
    'esri/graphic',
    'esri/geometry/Polygon',
    'dojo/store/Memory',
    'dojo/_base/lang',
    'dojo/_base/array',
    'dojo/topic',
    'dojo/dom-style',
    'dojo/dom-construct',
    'dojo/dom-class',
    'dojo/text!./Extract/templates/Extract.html',
    'dojo/text!./Extract/templates/ExtractResult.html',
    'esri/request',
    'dijit/form/CheckBox',

    'dijit/form/Form',
    'dijit/form/MultiSelect',
    'dijit/form/FilteringSelect',
    'dijit/form/ValidationTextBox',
    'dijit/form/NumberTextBox',
    'dijit/form/Button',
    'dijit/ProgressBar',
    'dijit/form/DropDownButton',
    'dijit/TooltipDialog',
    'dijit/form/RadioButton',
    'xstyle/css!./Extract/css/Extract.css'
], function (declare, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Geoprocessor, FeatureSet, Graphic, Polygon, Memory, lang, array, topic, Style, domConstruct, domClass, extractTemplate, extractResultTemplate, esriRequest, Checkbox) {

    // Main extract dijit
    var ExtractDijit = declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
        widgetsInTemplate: true,
        templateString: extractTemplate,
        map: null,
        count: 1,
        results: [],
        defaultFeatureFormat: null,
        defaultLayers: null,
        baseClass: 'gis_ExtractDijit',
        extractTaskURL: null,
        extractTask: null,
        postCreate: function () {
            this.inherited(arguments);
            this.extractTask = new Geoprocessor(this.extractTaskURL);
            this.extractTask.setOutSpatialReference(this.map.spatialReference);

            esriRequest({
                url: this.extractTaskURL,
                content: {
                    f: 'json'
                },
                handleAs: 'json',
                callbackParamName: 'callback',
                load: lang.hitch(this, '_handleExtractInfo'),
                error: lang.hitch(this, '_handleError')
            });
        },
        _handleError: function (err) {
            topic.publish('viewer/handleError', {
                source: 'Extract',
                error: err
            });
        },
        _handleExtractInfo: function (data) {
            // Feature_Format parameter
            var Feature_Format = array.filter(data.parameters, function (param) {
                return param.name === 'Feature_Format';
            });
            if (Feature_Format.length === 0) {
                topic.publish('viewer/handleError', {
                    source: 'Extract',
                    error: 'Extract service parameters name for templates must be \'Feature_Format\''
                });
                return;
            }
            var featureFormatItems = array.map(Feature_Format[0].choiceList, function (item) {
                return {
                    name: item,
                    id: item
                };
            });
            featureFormatItems.sort(function (a, b) {
                return (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0);
            });
            var featureFormatStore = new Memory({
                data: featureFormatItems
            });
            this.featureFormatDijit.set('store', featureFormatStore);
            if (this.defaultFeatureFormat) {
                this.featureFormatDijit.set('value', this.defaultFeatureFormat);
            } else {
                this.featureFormatDijit.set('value', Feature_Format[0].defaultValue);
            }
            
            // Feature_Format parameter
            var Raster_Format = array.filter(data.parameters, function (param) {
                return param.name === 'Raster_Format';
            });
            if (Raster_Format.length === 0) {
                topic.publish('viewer/handleError', {
                    source: 'Extract',
                    error: 'Extract service parameters name for templates must be \'Raster_Format\''
                });
                return;
            }
            var rasterFormatItems = array.map(Raster_Format[0].choiceList, function (item) {
                return {
                    name: item,
                    id: item
                };
            });
            rasterFormatItems.sort(function (a, b) {
                return (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0);
            });
            var rasterFormatStore = new Memory({
                data: rasterFormatItems
            });
            this.rasterFormatDijit.set('store', rasterFormatStore);
            if (this.defaultRasterFormat) {
                this.rasterFormatDijit.set('value', this.defaultRasterFormat);
            } else {
                this.rasterFormatDijit.set('value', Raster_Format[0].defaultValue);
            }
            
            //Layers_to_Clip parameter
            var Layers_to_Clip = array.filter(data.parameters, function (param) {
                return param.name === 'Layers_to_Clip';
            });
            if (Layers_to_Clip.length === 0) {
                topic.publish('viewer/handleError', {
                    source: 'Extract',
                    error: 'Extract service parameters name for format must be \'Layers_to_Clip\''
                });
                return;
            }
            this._clipItems = array.map(Layers_to_Clip[0].choiceList, function (item) {
                return {
                    name: item,
                    id: item
                };
            });
            this._clipItems.sort(function (a, b) {
                return (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0);
            });
            if(!this.defaultLayers && this.defaultLayers.length > 0) {
                if(this.defaultLayer) {
                    this.defaultLayers = [this.defaultLayer];
                } else {
                    this.defaultLayers = Layers_to_Clip[0].defaultValue;
                }
            }
            for (var clipItem in this._clipItems) {
                if (this._clipItems.hasOwnProperty(clipItem)) {
                    var checked = this.defaultLayers.indexOf(this._clipItems[clipItem].id)>=0;
                    this._clipItems[clipItem].save = checked
                    this._addCheckbox(clipItem, checked);
                }
            }
        },
        /**
         * creates a checkbox and sets the event handlers
         * @param {object} setting
         */
        _addCheckbox: function (clipItem, checked) {
            var li = domConstruct.create('li', null, this.clipList);
            this._clipItems[clipItem]._checkboxNode = new Checkbox({
                id: clipItem,
                checked: checked,
                onChange: lang.hitch(this, (function (clipItem) {
                    return function (checked) {
                        this._clipItems[clipItem].save = checked;
                    };
                }(clipItem)))
            });
            this._clipItems[clipItem]._checkboxNode.placeAt(li);
            domConstruct.create('label', {
                innerHTML: this._clipItems[clipItem].name,
                'for': clipItem
            }, li);
        },
        extractData: function () {
            var form = this.extractSettingsFormDijit.get('value');
            var clipLayers = [];
            for (var clipItem in this._clipItems) {
                if (this._clipItems.hasOwnProperty(clipItem)) {
                    if (this._clipItems[clipItem].save) {
                        clipLayers.push(this._clipItems[clipItem].id);
                    }
                }
            }
            if(!clipLayers.length > 0) {
                alert("Must select a layer");
            }

            var featureSet = new FeatureSet();
            var features = [];
            // use current extents (can't use the extent object directly for some reason)
            var polygon = new Polygon({
                "rings": [[
                    [this.map.extent.xmin, this.map.extent.ymin],
                    [this.map.extent.xmin, this.map.extent.ymax],
                    [this.map.extent.xmax, this.map.extent.ymax],
                    [this.map.extent.xmax, this.map.extent.ymin],
                    [this.map.extent.xmin, this.map.extent.ymin]
                ]],
                "spatialReference": this.map.spatialReference
            });
            var graphic = new Graphic(polygon);
            features.push(graphic);
            featureSet.features = features;

            var params = {
                "Layers_to_Clip": clipLayers,
                "Area_of_Interest": featureSet,
                "Feature_Format": form.featureFormat,
                "Raster_Format": form.rasterFormat
            };
            var fh = this.extractTask.submitJob(params);

            var result = new ExtractResultDijit({
                count: this.count.toString(),
                fileHandle: fh,
                ex: this.extractTask
            }).placeAt(this.extractResultsNode, 'last');
            result.startup();
            Style.set(this.clearActionBarNode, 'display', 'block');
            this.count++;
        },

        clearResults: function () {
            domConstruct.empty(this.extractResultsNode);
            Style.set(this.clearActionBarNode, 'display', 'none');
            this.count = 1;
        }
    });

    // Extract result dijit
    var ExtractResultDijit = declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
        widgetsInTemplate: true,
        templateString: extractResultTemplate,
        url: null,
        postCreate: function () {
            this.inherited(arguments);
            this.fileHandle.then(lang.hitch(this, '_onExtractComplete'), lang.hitch(this, '_onExtractError'), lang.hitch(this, '_onStatusUpdate'));
        },
        _onExtractComplete: function (jobInfo) {
            if (jobInfo.jobStatus !== "esriJobFailed") {
                this.ex.getResultData(jobInfo.jobId, 'Output_Zip_File', lang.hitch(this, '_onGetResults'));
            } else {
                this._onExtractError('Error, try again');
            }
        },
        _onGetResults: function (outputFile) {
            var theurl = outputFile.value.url;
            window.location = theurl;
        },
        _onExtractError: function (err) {
            topic.publish('viewer/handleError', {
                source: 'Extract',
                error: err
            });
            this.nameNode.innerHTML = '<span class="bold">Error, try again</span>';
            domClass.add(this.resultNode, 'esriJobFailed');
        },
        _onStatusUpdate: function (jobInfo) {
            this.nameNode.innerHTML = '<span class="bold">' + jobInfo.jobStatus.substring(7) + '</span>';
            domClass.add(this.resultNode, jobInfo.jobStatus);
        }
    });
    return ExtractDijit;
});