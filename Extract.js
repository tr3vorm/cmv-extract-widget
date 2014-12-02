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

    'dijit/form/Form',
    'dijit/form/FilteringSelect',
    'dijit/form/ValidationTextBox',
    'dijit/form/NumberTextBox',
    'dijit/form/Button',
    'dijit/form/CheckBox',
    'dijit/ProgressBar',
    'dijit/form/DropDownButton',
    'dijit/TooltipDialog',
    'dijit/form/RadioButton',
    'xstyle/css!./Extract/css/Extract.css'
], function (declare, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Geoprocessor, FeatureSet, Graphic, Polygon, Memory, lang, array, topic, Style, domConstruct, domClass, extractTemplate, extractResultTemplate, esriRequest) {

    // Main extract dijit
    var ExtractDijit = declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
        widgetsInTemplate: true,
        templateString: extractTemplate,
        map: null,
        count: 1,
        results: [],
        defaultFormat: null,
        defaultLayer: null,
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
            var formatItems = array.map(Feature_Format[0].choiceList, function (item) {
                return {
                    name: item,
                    id: item
                };
            });
            formatItems.sort(function (a, b) {
                return (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0);
            });
            var layout = new Memory({
                data: formatItems
            });
            this.formatDijit.set('store', layout);
            if (this.defaultFormat) {
                this.formatDijit.set('value', this.defaultFormat);
            } else {
                this.formatDijit.set('value', Feature_Format[0].defaultValue);
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
            var clipItems = array.map(Layers_to_Clip[0].choiceList, function (item) {
                return {
                    name: item,
                    id: item
                };
            });
            clipItems.sort(function (a, b) {
                return (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0);
            });
            var clip = new Memory({
                data: clipItems
            });
            this.clipDijit.set('store', clip);
            if (this.defaultLayer) {
                this.clipDijit.set('value', this.defaultLayer);
            } else {
                this.clipDijit.set('value', Layers_to_Clip[0].defaultValue);
            }

        },
        extractData: function () {
            var form = this.extractSettingsFormDijit.get('value');
            var clipLayers = [];
            clipLayers.push(form.clip);

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
                "Feature_Format": form.format
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