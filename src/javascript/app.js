Ext.define("HistoricalRanks", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container',itemId:'button_box'},
        {xtype:'container',itemId:'display_box'},
        {xtype:'tsinfolink'}
    ],
    launch: function() {
        var me = this;
        this.setLoading("Loading stuff...");
        
        this._loadHistoryOn('2015-02-24T17:00:00Z').then({
            scope: this,
            success: function(records) {
                records.sort(
                    function(a,b) {
                        if ( a.get('DragAndDropRank') > b.get('DragAndDropRank') ) {
                            return 1;
                        }
                        if ( a.get('DragAndDropRank') < b.get('DragAndDropRank') ) {
                            return -1;
                        }
                        return 0;
                    }
                );
                
                this._displayGrid(records);
            },
            failure: function(error_message){
                alert(error_message);
            }
        }).always(function() {
            me.setLoading(false);
        });
    },
    _loadHistoryOn: function(at_date){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        
        this.logger.log("Load History at: ", at_date);
        
        Ext.create('Rally.data.lookback.SnapshotStore', {
            filters: [
                { property: "__At", value: at_date},
                { property: "_TypeHierarchy", operator: "in", value: ["HierarchicalRequirement","Defect"] }
            ],
            fetch:  ["DragAndDropRank","FormattedID","CreationDate","Project","Name"],
            hydrate: ["Project"]
        }).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(records);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },
    _displayGrid: function(records){
        var store = Ext.create('Rally.data.custom.Store',{
            data: records
        });
        
        var grid = this.down('#display_box').add({
            xtype: 'rallygrid',
            store: store,
            columnCfgs: [
                { dataIndex: 'FormattedID', text: 'id' }, 
                { dataIndex: 'Name', text: 'Name', flex: 1},
                { dataIndex: 'DragAndDropRank', text: 'Note', renderer: function(value){ 
                    if ( ! value ) {
                        return "Warning";
                    }
                    return value;
                } },
                { dataIndex: 'Project', text: 'Project', renderer: function(value) { return value.Name; } }
            ]
        });
        
        this._addButton(grid,store);
    },
    _addButton: function(grid,store) {
        this.down('#button_box').add({
            xtype:'rallybutton',
            text: 'Export',
            listeners: {
                scope: this,
                click: function(button) {
                    this._getCSVFromGrid(grid,store).then({
                        scope: this,
                        success: function(csv) {
                            this._saveCSVToFile(csv,'ranked-list.csv',{type:'text/csv;charset=utf-8'});
                        }
                    });
                }
            }
            
        });
    },
    _isAbleToDownloadFiles: function() {
        try { 
            var isFileSaverSupported = !!new Blob(); 
        } catch(e){
            this.logger.log(" NOTE: This browser does not support downloading");
            return false;
        }
        return true;
    },
    _getCSVFromGrid:function(grid, store){
        var deferred = Ext.create('Deft.Deferred');
        
        this.setLoading(true);
        
        var columns = grid.columns;
        var column_names = [];
        var headers = [];
        
        var csv = [];
        
        Ext.Array.each(columns,function(column){
            if ( column.dataIndex ) {
                column_names.push(column.dataIndex);
                headers.push(column.text);
            }
        });
        
        
        csv.push('"' + headers.join('","') + '"');
        
        store.pageSize = 200000;
        
        store.load({ 
            scope: this,
            callback: function(records) {
                var number_of_records = store.getTotalCount();
                                                
                for ( var i=0; i<number_of_records; i++ ) {
                    var record = store.getAt(i);
                    var node_values = [];
                    Ext.Array.each(columns,function(column){
                        if ( column.dataIndex) {
                            var column_name = column.dataIndex;
                            var display_value = record.get(column_name);
                            if ( column.renderer ) {
                                display_value = column.renderer(display_value);
                            }
                            if ( display_value ) {
                                display_value = display_value.replace(/"/g,"'");
                            }
                            node_values.push(display_value);
                        }
                    },this);
                    
                    
                    csv.push('"' + node_values.join('","') + '"');
                }  
                this.setLoading(false);
                
                deferred.resolve( csv.join('\r\n') );
            }
        });
        
        return deferred.promise;
        
    },
    _saveCSVToFile:function(csv,file_name,type_object){
        var blob = new Blob([csv],type_object);
        saveAs(blob,file_name);
    }
});
