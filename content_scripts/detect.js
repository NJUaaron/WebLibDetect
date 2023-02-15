(() => {
    /**
     * Check and set a global guard variable.
     * If this content script is injected into the same page again,
     * it will do nothing next time.
     */
    if (window.DetectorHasRun) {
        return;
    }
    window.DetectorHasRun = true;

    function getAttr(v) {
        if (v == undefined || v == null) {
            return [];
        }
        if (typeof (v) == 'object' || typeof (v) == 'function') {
            return Object.keys(v);
        }   
        return [];
    }

    function hasSameAddr(prefix, v) {
        // Prevent loop in the object tree
        // Check whether v points to some parent variable
        if (!prefix)
            return false
        let _v = `${prefix}["${v}"]`

        try{
            if (eval(`typeof (${_v}) != 'object' && typeof (${_v}) != 'function'`)) 
                return false
            if (eval(`typeof (${prefix}) == 'object' || typeof (${prefix}) == 'function'`))
                if (eval(`${prefix} == ${_v}`))
                    return true
        }
        catch(err){     // TypeError: 'get nodeType' called on an object that does not implement interface Node.
            return false
        }
        
        
        let needClose = true
        for(let p = prefix.length - 1; p > 0; p -= 1) {        
            if (needClose && prefix[p-1] == '"' && prefix[p] == ']') {
                needClose = false
                p-=1
            }
            else if (prefix[p-1] == '[' && prefix[p] == '"') {
                needClose = true
                let parent_v = prefix.slice(0, p-1)
                    if (eval(`typeof (${parent_v}) == 'object' || typeof (${parent_v}) == 'function'`))
                        if (eval(`${parent_v} == ${_v}`))
                            return true
            }
        }

        return false
    }

    function findKeywords(pts, blacklist, depth_limit=3) {
        let keyword_list = []
        let q = []
        q.push([])
        while (q.length) {
            let v_path = q.shift()

            let v_str = 'window'
            for (let v of v_path) {
                v_str += `["${v}"]`
            }

            let children;
            try{
                children = eval(`getAttr(${v_str})`);

            }
            catch(err){
                children = [];
            }
            // children = eval(`getAttr(${v_str}")`);

            // Remove global variables in blacklist
            if (v_path.length == 0)
            children = children.filter(val => !blacklist.includes(val));

            if (v_path.length < depth_limit) {
                for (let child_v of children) {
                    if (pts.hasOwnProperty(child_v)) {
                        keyword_list.push([child_v, `${v_str}["${child_v}"]`])
                    }
                    q.push([...v_path])
                    q[q.length - 1].push(child_v)
                }
            }    
        }
        return keyword_list
    }

    // var keywords = [];
    // function findKeywords(prefix, v_name, pts, depth) {
    //     // st_index @: subtrees_index dict     
    //     if (depth > 3) return;
    //     if (hasSameAddr(prefix, v_name)) return;
    //     if (pts.hasOwnProperty(v_name)) {
    //         keywords.push([v_name, prefix])
    //     }
    //     // console.log(`${prefix}["${v_name}"]`)
    //     let children;
    //     try{
    //         children = eval(`analyzeVariable2(${prefix}["${v_name}"])`);

    //     }
    //     catch(err){
    //         children = [];
    //     }
    //     // console.log(children)
    //     for (let child_v of children) {
    //         findKeywords(`${prefix}["${v_name}"]`, child_v, pts, depth + 1)
    //     }
    // }

    
    function compare_Dict_V (_dict, v) {
        if (!_dict) return false;
        if (v == undefined) {
            if (_dict['t'] == 1) return true;
            else return false;
        }
        if (v == null) {
            if (_dict['t'] == 2) return true;
            else return false;
        }
        if (Array.isArray(v)) {
            if (_dict['t'] == 3 && _dict['v'] == v.length) return true;
            else return false;
        }
        if (typeof (v) == 'string') {
            if (_dict['t'] == 4 && _dict['v'] == v.slice(0, 10).replace(/<|>/g, '_')) return true;
            else return false;
        }
        if (typeof (v) == 'object') {
            if (_dict['t'] == 5) return true;
            else return false;
        }
        if (typeof (v) == 'function') {
            if (_dict['t'] == 6) return true;
            else return false;        
        }
        if (typeof (v) == 'number') {
            if (_dict['t'] == 7 && _dict['v'] == v.toFixed(2)) return true;
            else return false;
        }
        // Other condition
        if (_dict['t'] == typeof (v)) return true;
        else return false;
    }
    
    function matchPTree(pt, base) {
        // BFS
        let match_record = {}
        let q = []      // Property Path Queue
        let qc = []     // pTree Queue
        q.push([])
        qc.push(pt)

        while (qc.length) {
            let v_path = q.shift()
            let cur_node = qc.shift()

            let v_str = base
            for (let v of v_path) {
                v_str += `["${v}"]`
            }

            // match_record:
            //  { file_id: {
            //      'credit1': credit1 score
            //      'matched': matched node number
            //   } }

            for (let _dict of cur_node['d']) {
                if (eval(`compare_Dict_V (_dict['d'], ${v_str})`)) {
                    for (let lib_info of _dict['Ls']) {
                        let file_id = lib_info['F']
                        let credit1 = lib_info['x']
                        if (match_record.hasOwnProperty(file_id)) {
                            match_record[file_id]['credit1'] += credit1
                            match_record[file_id]['matched'] += 1
                        }
                        else {
                            match_record[file_id] = {'credit1': credit1, 'matched': 1, 'base': base}
                        }
                    }
                }
            }

            let v_prop = eval(`getAttr(${v_str})`)
            console.log(v_prop)
            for (let child of cur_node['c']) {
                if (v_prop.includes(child['n'])) {
                    console.log('includes')
                    q.push([...v_path])              // shallow copy
                    q[q.length - 1].push(child['n'])
                    qc.push(child)
                }
            }             

        }
        return match_record
    }

    function classifyLib(match_records, file_list) {
        let lib_match_list = []

        // lib_match_list: [ {
        //     lib: lib name
        //     files: [ {
        //         'name': file name
        //         'credit1': credit1 score
        //         'matched': matched node number
        //         'base': the matched root path
        //     } ]
        // } ]

        for (let match_record_pair of match_records) {
            let match_record = match_record_pair[0]
            for (let file_id in match_record) {
                // let file_tag = file_list[file_id]
                // let at_index = file_tag.indexOf('@')
                // let lib_name = file_tag.slice(0, at_index)
                let file_obj = file_list[file_id]
                let lib_name = file_obj['libname']
                let file_info = match_record[file_id]
                file_info['name'] = `${file_obj['filename']} (${file_obj['version']})`
                file_info['base'] = match_record_pair[1]

                let find_lib_name = false
                for (let lib_info of lib_match_list) {
                    if (lib_info['lib'] == lib_name) {
                        find_lib_name = true
                        lib_info['files'].push(file_info)
                        break
                    }
                }
                if (!find_lib_name) {
                    lib_match_list.push({
                        'lib': lib_name,
                        'files': [file_info]
                    })
                }
            }
        }
        return lib_match_list
    }

    function sortScore(lib_match_list) {
        for (lib_info of lib_match_list) {
            lib_info['files'].sort((a, b) => b['credit1']-a['credit1'])
            lib_info['score'] = lib_info['files'][0]['credit1']
        }
        lib_match_list.sort((a, b) => b['score']-a['score'])
    }

    /**
     * Listen for messages from the content script.
     */
    window.addEventListener("message", function (event) {
        if (event.data.type == 'detect') {
            let requests = event.data.urls.map((url) => {
                return fetch(url).then((response) => {
                    return response.json()})
            });
            Promise.all(requests)
                .then((results) => {
                    let blacklist = results[0]
                    let pts = results[1]
                    let file_list = results[2]

                    // Find all keywords in the web object tree
                    let keyword_list = findKeywords(pts, blacklist, 3)
                    // console.log(keyword_list);

                    // Calculate the credit for each library
                    let match_records = []
                    for (let keyword of keyword_list) {
                        let v_name = keyword[0]
                        let v_path = keyword[1]
                        let pt = pts[v_name]
                        let match_record = matchPTree(pt, v_path)
                        match_records.push([match_record, v_path])
                    }

                    // console.log(match_records)

                    // Classify match_record based on lib name
                    lib_match_list = classifyLib(match_records, file_list)
                    // console.log(lib_match_list)


                    // Sort the result based on credit score
                    sortScore(lib_match_list)
                    console.log(lib_match_list)


                    // let result_table2 = []
                    // for (let result of result_table) {
                    //     if (result['score'] >= 50 && result['matched node'] >= 5) {
                    //         result_table2.push(result)
                    //     }
                    // }
                    // console.log(result_table2)

                })

        }


    });
})();
