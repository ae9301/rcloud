define(['angular'], function(angular) {

   'use strict';

    function extract_error(err) {
        console.log(err);
        var s = err.toString().replace(/\n/g, '');
        return /.*: +(.*)R trace/.exec(s)[1];
    }

    function promise_for(condition, action, value) {
        if(!condition(value))
            return value;
        return action(value).then(promise_for.bind(null, condition, action));
    }

    // like Promise.each but each promise is not *started* until the last one completes
    function promise_sequence(collection, operator) {
        return promise_for(
            function(i) {
                return i < collection.length;
            },
            function(i) {
                return operator(collection[i]).return(++i);
            },
        0);
    }

    var logger = RCloud.UI.notebook_protection_logger;
    var moduleRef = RCloud.UI.notebook_protection;


    return angular.module('myapp.controllers', ['myapp.services', 'selectize'])
    .controller('NotebookProtectionController', ['$scope' , 'GroupsService', '$q', '$timeout', function ($scope, GroupsService, $q, $timeout) {

        $scope.currentNotebook = null;
        $scope.currentCryptogroup = null;
        $scope.notebookFullName = null;
        $scope.notebookGistName = null;
        $scope.notebookId = null;
        $scope.userName = editor.username();

        $scope.sharedStatus = '';
        $scope.initialSharedStatus = '';
        $scope.initialGroupId = '';

        $scope.allUsers = editor.allTheUsers;
        $scope.myConfig = { openOnFocus: false };

        $scope.currentTab = null;

        $scope.selectedUserGroup = null;
        $scope.selectedAdminGroup = null;

        $scope.allUserGroups = [];
        $scope.allAdminGroups = [];
        $scope.groupAdmins = [];
        $scope.groupMembers = [];
        $scope.originalAdmins = [];
        $scope.originalMembers = [];

        //way to stop watching collections
        $scope.theWatcherAdmins = null;
        $scope.theWatcherMembers = null;

        //init
        ////////////////////////////////////////////
        $scope.initBoth = function() {

            $scope.evalData()
            .then(function() {
                return $scope.getGroups();
            })
            .then(function() {
                if($scope.currentCryptogroup)
                    return $scope.setFirstSelectoToId($scope.currentCryptogroup.id);
                else
                    return $scope.setFirstSelectoToId(null);
            })
            .then(function() {
                if($scope.currentCryptogroup)
                    return $scope.setSecondSelectoToId($scope.currentCryptogroup.id);
                else
                    return $scope.setSecondSelectoToId(null);
            })
            .then(function() {
                //console.log('done');
            });
        };

        $scope.initGroups = function() {

            $scope.$evalAsync(function() {
                $scope.currentTab = 2;
            });
            $scope.getGroups()
            .then(function() {
                if($scope.allAdminGroups.length)
                    $scope.setSecondSelectoToId($scope.allAdminGroups[0].id);

                _.delay(function() {
                    $scope.anotherAdminGroupSelected();
                }, 50);
            })
            .then(function() {
                $scope.anotherAdminGroupSelected();
                $scope.startWatchingGroups();
                //console.log('done');
            });
        };

        //NOTEBOOK TAB METHODS
        /////////////////////////////////////////
        $scope.getGroups = function() {
            return $q(function(resolve, reject) {
                GroupsService.getUsersGroups($scope.userName)
                .then(function(data) {

                    $scope.$evalAsync(function() {
                        $scope.allUserGroups = $scope.parseGroups(data).all;
                        $scope.allAdminGroups = $scope.parseGroups(data).admins;
                    });

                    //timeout to ensure evalAsync has finished
                    $timeout(function() {
                        logger.clear();
                        resolve();
                    }, 50);
                });
            });
        };

        $scope.evalData = function() {
            return $q(function(resolve, reject) {
                $scope.$evalAsync(function() {
                    $scope.currentTab = 1;
                
                    $scope.currentNotebook = moduleRef.defaultNotebook;
                    $scope.currentCryptogroup = moduleRef.defaultCryptogroup;
                    $scope.notebookFullName = moduleRef.defaultNotebook.full_name;
                    $scope.notebookGistName = moduleRef.defaultNotebook.gistname;
                    $scope.notebookId = moduleRef.defaultNotebook.id;

                    if(moduleRef.defaultCryptogroup === null){
                        $scope.sharedStatus = 'public';
                        $scope.initialSharedStatus = 'public';
                    }
                    else if(moduleRef.defaultCryptogroup.id !== null && moduleRef.defaultCryptogroup.name !== null) {
                       $scope.sharedStatus = 'group';
                       $scope.initialSharedStatus = 'group';
                       $scope.initialGroupId = moduleRef.defaultCryptogroup.id;
                    }
                    else if(moduleRef.defaultCryptogroup.id === 'private' && moduleRef.defaultCryptogroup.name == null) {
                        $scope.sharedStatus = 'private';
                        $scope.initialSharedStatus = 'private';
                    }
                    //timeout to ensure evalAsync has finished
                    $timeout(function() {
                        resolve();
                    }, 50);
                });
            });
        };

        $scope.saveNotebookTab = function() {
            //status has not changed
            if($scope.sharedStatus === $scope.initialSharedStatus) {
                if($scope.initialGroupId !== '' && $scope.initialGroupId !== $scope.selectedUserGroup.id) {
                    //console.log('id changed');
                    (function(){
                        var conf = confirm("Are you sure you want to move notebook "+$scope.notebookFullName+" to group "+$scope.selectedUserGroup.name +"?\nThis might make it no longer accessible by everyone.");
                        if(conf){
                            console.log('notebook id is '+$scope.notebookGistName);
                            GroupsService.setNotebookGroup($scope.notebookGistName, $scope.selectedUserGroup.id )
                            .then(function(data){
                                //console.log('data is '+data);
                                //need to update the notebook's tip to reflect the change
                                $scope.cancel();
                            })
                            .catch(function(e){
                                logger.warn(extract_error(e));
                            });
                        }
                    })();
                }
                else {
                    //console.log('id didnt change');
                    $scope.cancel();
                }
                return;
            }
            else {
                //if making private of moving to another group
                if($scope.sharedStatus === 'group') {
                    (function() {
                        var conf = confirm("Are you sure you want to move notebook "+$scope.notebookFullName+" to group "+$scope.selectedUserGroup.name +"?\nThis might make it no longer accessible by everyone.");
                        if(conf) {
                            //console.log('notebook id is '+$scope.notebookGistName);
                            GroupsService.setNotebookGroup($scope.notebookGistName, $scope.selectedUserGroup.id )
                            .then(function(data){
                                //console.log('data is '+data);
                                $scope.cancel();
                            })
                            .catch(function(e){
                                logger.warn(extract_error(e));
                            });
                        }
                    })();
                }
                else if($scope.sharedStatus === 'public') {
                    (function() {
                        var conf = confirm("Are you sure you want to make notebook "+$scope.notebookFullName+" public? \nThis will make it accessible by everyone.");
                        if(conf) {
                            //console.log('notebook id is '+$scope.notebookGistName);
                            GroupsService.setNotebookGroup($scope.notebookGistName, null )
                            .then(function(data){
                                $scope.cancel();
                            })
                            .catch(function(e){
                                logger.warn(extract_error(e));
                            });
                        }
                    })();
                }
                else if($scope.sharedStatus === 'private') {
                    //private logic goes here
                    (function() {
                        var conf = confirm("Are you sure you want to make notebook "+$scope.notebookFullName+" truly private?");
                        if(conf) {
                            //console.log('notebook id is '+$scope.notebookGistName);
                            GroupsService.setNotebookGroup($scope.notebookGistName, 'private' )
                            .then(function(data) {
                                $scope.cancel();
                            })
                            .catch(function(e) {
                                logger.warn(extract_error(e));
                            });
                        }
                    })();
                }
            }
        };

        //GROUPS
        ////////////////////////////////////////////
        $scope.createGroup = function() {
            var pr = prompt("Enter new group name", "");
            if (pr != null) {
                if(pr === 'private' || pr === 'no group') {
                    logger.warn(pr+ ' is a reserved name, please pick a different one.');
                    return;
                }
                GroupsService.createGroup(pr)
                .then(function(data) {
                    $scope.$evalAsync(function() {
                        $scope.allUserGroups.push({
                            id:data,
                            name:pr,
                            isAdmin:true
                        });
                        $scope.allAdminGroups.push({
                            id:data,
                            name:pr,
                            isAdmin:true
                        });
                    });
                    $scope.$evalAsync(function() {
                        // //set select to the last item in the array
                        $scope.selectedAdminGroup = $scope.allAdminGroups[$scope.allAdminGroups.length - 1];
                        if(!$scope.selectedUserGroup) {
                            $scope.selectedUserGroup = $scope.allUserGroups[0];
                        }
                    });
                    //console.log('group created and selected '+data);
                    _.defer(function() {
                        $scope.populateGroupMembers();
                        logger.clear();
                    });
                })
                .catch(function(e) {
                    logger.warn(extract_error(e));
                });
            };
        };

        $scope.renameGroup = function() {

            if(!$scope.selectedAdminGroup || !$scope.allAdminGroups.length)
                return;

            var pr = prompt("Rename group "+$scope.selectedAdminGroup.name , $scope.selectedAdminGroup.name);
            if(pr != null) {
                var r = confirm('Are you sure you want to rename group "'+$scope.selectedAdminGroup.name+' to "'+pr+'"?');
                if(r === true) {
                    var prevGroupId = $scope.selectedAdminGroup.id;
                    GroupsService.changeGroupName($scope.selectedAdminGroup.id ,pr)
                    .then(function(data) {
                        //console.log('renamed group');
                        var indexAdmins = $scope.getIndexOfNameFromGroup($scope.selectedAdminGroup.name, $scope.allAdminGroups);
                        var indexUsers = $scope.getIndexOfNameFromGroup($scope.selectedAdminGroup.name, $scope.allUserGroups);
                        $scope.$evalAsync(function() {
                            if(indexAdmins !== -1)
                                $scope.allAdminGroups[indexAdmins].name = pr;
                            if(indexUsers !== -1)
                                $scope.allUserGroups[indexUsers].name = pr;
                        });
                        logger.clear();
                    })
                    .catch(function(e) {
                        logger.warn(extract_error(e));
                    });
                }
            }
        };

        $scope.populateGroupMembers = function() {
            if(!$scope.selectedAdminGroup)
                return;

            GroupsService.getAllUsersinGroup($scope.selectedAdminGroup.id)
            .then(function(data) {
                var adminsArray = [];
                var membersArray = [];
                for(var item in data) {
                    if(item !== 'r_attributes' && item !== 'r_type') {
                        if(data[item] === true)
                            adminsArray.push(item);
                        else
                            membersArray.push(item);
                    }
                }
                //console.log('just grabed memebers info for group '+$scope.selectedAdminGroup.name);
                $scope.$evalAsync(function() {

                    $scope.groupAdmins = adminsArray;
                    $scope.groupMembers = membersArray;
                });
                $scope.originalAdmins = adminsArray.slice(0);//$scope.groupAdmins.slice(0);
                $scope.originalMembers = membersArray.slice(0);//['fourthark','gordonwoodhull'];
                //logger.clear();
            })
            .catch(function(e) {
                logger.warn(extract_error(e));
            });
        };

        $scope.anotherAdminGroupSelected = function() {
            $scope.populateGroupMembers();
        };

        //Admins and Memebers areas
        ////////////////////////////////////////////
        $scope.startWatchingGroups = function() {
            //console.log("starting watching groups");
            var count1 = 0;
            var count2 = 0;
            $scope.theWatcherAdmins = $scope.$watch('groupAdmins', function (val) {
                if(count1 === 0) {
                    count1 ++;
                    return;
                }
                else {
                    count1 ++;
                    //logic here
                    //console.log('groupAdmins changed '+val);
                    //console.log('groupAdmins is '+$scope.groupAdmins);
                    var duplicates = _.intersection($scope.groupAdmins, $scope.groupMembers);
                    if(duplicates.length) {
                        logger.log('removing '+duplicates+' from members and moving to admins');
                        //remove
                        var dupIndex = $scope.groupMembers.indexOf(duplicates[0]);
                        $scope.groupMembers.splice(dupIndex, 1);
                    }
                }
            });

            $scope.theWatcherMembers = $scope.$watch('groupMembers', function (val) {
                if(count2 === 0) {
                    count2 ++;
                    return;
                }
                else {
                    count2 ++;
                    //logic here
                    //console.log('groupMembers changed '+val);
                    var duplicates = _.intersection($scope.groupMembers, $scope.groupAdmins);
                    if(duplicates.length) {
                        logger.log('removing '+duplicates+' from admins and moving to members');
                        //remove
                        var dupIndex = $scope.groupAdmins.indexOf(duplicates[0]);
                        $scope.groupAdmins.splice(dupIndex, 1);
                    }
                }
            });
        };

        $scope.stopWatching = function() {
            //console.log("stopping watching groups");
            //stop watching admin and member models
            if(typeof $scope.theWatcherAdmins === 'function' ) {
                $scope.theWatcherAdmins();
                $scope.theWatcherMembers();
            }
        };

        $scope.saveGroupTab = function() {
            //compare original admins array and its current state
            var removedAdmins = _.difference($scope.originalAdmins, $scope.groupAdmins);
            var addedAdmins = _.difference($scope.groupAdmins, $scope.originalAdmins);
            //compare original members array and its current state
            var removedMembers = _.difference($scope.originalMembers, $scope.groupMembers);
            var addedMembers = _.difference($scope.groupMembers, $scope.originalMembers);
            var outputMessage = '';
            //removed and added members
            if(!removedAdmins.length && !addedAdmins.length && !removedMembers.length && !addedMembers.length ) {
                $scope.cancel();
                return;
            }
            else {
                outputMessage += 'Please confirm the following changes:\n\n';
                if(removedAdmins.length) {
                    outputMessage += 'you removed admins \n';
                    for(var i = 0; i < removedAdmins.length; i ++) {
                        outputMessage += '   - '+removedAdmins[i]+'\n';
                    }
                }
                if(addedAdmins.length) {
                    outputMessage += 'you added admins \n';
                    for(var a = 0; a < addedAdmins.length; a ++) {
                        outputMessage += '   - '+addedAdmins[a]+'\n';
                    }
                }
                if(removedMembers.length) {
                    outputMessage += 'you removed members \n';
                    for(var b = 0; b < removedMembers.length; b ++) {
                        outputMessage += '   - '+removedMembers[b]+'\n';
                    }
                }
                if(addedMembers.length) {
                    outputMessage += 'you added members \n';
                    for(var v = 0; v < addedMembers.length; v ++) {
                        outputMessage += '   - '+addedMembers[v]+'\n';
                    }
                }

                var pr = confirm(outputMessage);
                if(pr) {
                    //push the data
                    var allPromises = [];
                    if(removedAdmins.length) {
                        for(var q = 0; q < removedAdmins.length; q++) {
                            //create a promise for each action
                            allPromises.push(function(){
                                return GroupsService.removeGroupUser($scope.selectedAdminGroup.id, removedAdmins[q]);
                            });

                        
                        }
                    }
                    if(addedAdmins.length) {
                        for(var w = 0; w < addedAdmins.length; w++) {
                            //create a promise for each action
                            allPromises.push(function(){
                                return GroupsService.addGroupUser($scope.selectedAdminGroup.id, addedAdmins[w], true);
                            });
                        }
                    }
                    if(removedMembers.length) {
                        for(var e = 0; e < removedMembers.length; e++) {
                            //create a promise for each action
                            allPromises.push(function(){
                               return GroupsService.removeGroupUser($scope.selectedAdminGroup.id, removedMembers[e]);
                            });
                        }
                    }
                    if(addedMembers.length) {
                        for(var r = 0; r < addedMembers.length; r++) {
                            //create a promise for each action
                            //var prom = ;
                            allPromises.push(function(){
                                return GroupsService.addGroupUser($scope.selectedAdminGroup.id, addedMembers[r], false) 
                            });
                        }
                    }

                    var seq = promise_sequence(allPromises, function(f) { 
                        return f(); 
                    });

                    seq
                    .then(function() {
                        //console.log('pushing member data succeeded');
                        $scope.cancel();
                    })
                    .catch(function(e) {
                        logger.warn(extract_error(e));
                        $scope.populateGroupMembers();
                    });
                }
            }
        };

        //Global Save and Cancel
        ////////////////////////////////////////////
        $scope.cancel = function() {
            $("#notebook-protection-dialog").modal('hide');
            $scope.stopWatching();
            logger.clear();
            $scope.reset();
        };

        $scope.save = function() {
            if($scope.currentTab === 1) {
                $scope.saveNotebookTab();
            }
            else if($scope.currentTab === 2) {
                $scope.saveGroupTab();
            }
        };

        //UTILS
        ////////////////////////////////////////////
        $scope.setTab = function(index) {
            if(index ===1){
                if($scope.currentTab !== 1) {
                    $scope.currentTab = index;
                    if(!$('#protection-app #tab1').hasClass('disabled'));
                        $scope.stopWatching()
                }
            }
            if(index === 2) {
                if($scope.currentTab !== 2){
                    $scope.currentTab = index;
                    _.delay(function() {
                        if($scope.selectedAdminGroup) {
                            $scope.populateGroupMembers();
                            $scope.startWatchingGroups();
                        }
                    }, 40);
                }
            }
        };

        $scope.reset = function() {
            //console.log('reset called');
            $scope.currentNotebook = null;
            $scope.currentCryptogroup = null;
            $scope.notebookFullName = null;
            $scope.notebookGistName = null;
            $scope.notebookId = null;

            $scope.sharedStatus = '';
            $scope.initialSharedStatus = '';
            $scope.initialGroupId = '';

            $scope.currentTab = null;

            $scope.selectedUserGroup = null;
            $scope.selectedAdminGroup = null;

            $scope.allUserGroups = [];
            $scope.allAdminGroups = [];
            $scope.groupAdmins = [];
            $scope.groupMembers = [];
            $scope.originalAdmins = [];
            $scope.originalMembers = [];
        };

        $scope.getIndexOfNameFromGroup = function(name, groupArray) {
            for(var i = 0; i < groupArray.length; i ++) {
                if( groupArray[i].name === name) {
                    return i;
                    break;
                }
            }
            return -1;
        };

        $scope.anotherUserGroupSelected = function() {
            $scope.setSecondSelectoToId( $scope.selectedUserGroup[0]);
        };

        $scope.setFirstSelectoToId = function(id) {
            return $q(function(resolve, reject) {

                if(id === null || id === 'private') {
                    $scope.$evalAsync(function() {
                        $scope.selectedUserGroup = $scope.allUserGroups[0];
                    });
                    $timeout(function() {
                        resolve();
                    }, 50);
                    return;
                }

                var index = 0;
                for(var i = 0; i < $scope.allUserGroups.length; i ++ ) {
                    if($scope.allUserGroups[i].id === id) {
                        index =  i;
                        break;
                    }
                }
                $scope.$evalAsync(function() {
                    $scope.selectedUserGroup = $scope.allUserGroups[index];
                });
                //timeout to ensure evalAsync has finished
                $timeout(function() {
                    resolve();
                }, 50);
            });
        };

        $scope.setSecondSelectoToId = function(id) {
            return $q(function(resolve, reject) {

                if(id === null || id === 'private') {
                    if($scope.allAdminGroups.length) {
                        $scope.$evalAsync(function() {
                            $scope.selectedAdminGroup = $scope.allAdminGroups[0];
                        });
                    }
                    $timeout(function() {
                        resolve();
                    }, 50);
                    return;
                }
                var index = 0;
                for(var i = 0; i < $scope.allAdminGroups.length; i ++ ) {
                    if($scope.allAdminGroups[i].id === id) {
                        index =  i;
                        break;
                    }
                }
                $scope.$evalAsync(function() {
                    $scope.selectedAdminGroup = $scope.allAdminGroups[index];
                });
                //timeout to ensure evalAsync has finished
                $timeout(function() {
                    resolve();
                }, 50);
            });
        };

        $scope.parseGroups = function(data) {
            var finalArrayAll = [],
                finalArrayAdmins = [],
                keys = _.keys(data),
                vals = _.values(data);
            //convert received objects to flat array
            for(var i = 0; i < vals.length; i ++) {
                var val = vals[i];
                if( _.isArray(val) ) {
                    var obj = {};
                    obj.id = (keys[i]);
                    obj.name = (val[0]);
                    obj.isAdmin = (val[1]);
                    if(obj.isAdmin)
                        finalArrayAdmins.push(obj);
                    finalArrayAll.push(obj);
                }
            }
            return {
                all: finalArrayAll,
                admins: finalArrayAdmins
            };
        };

    }]);
});
