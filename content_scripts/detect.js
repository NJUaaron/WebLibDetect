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



    class TreeNode {
        constructor(_name, _dict) {
            this.name = _name
            this.dict = _dict
            this.children = []
        }
    }

    function analyzeVariable2(v) {
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

    var keywords = [];
    function findKeywords(prefix, v_name, pts, depth) {
        // st_index @: subtrees_index dict     
        if (depth > 3) return;
        if (hasSameAddr(prefix, v_name)) return;
        if (pts.hasOwnProperty(v_name)) {
            keywords.push([v_name, prefix])
        }
        // console.log(`${prefix}["${v_name}"]`)
        let children;
        try{
            children = eval(`analyzeVariable2(${prefix}["${v_name}"])`);

        }
        catch(err){
            children = [];
        }
        // console.log(children)
        for (let child_v of children) {
            findKeywords(`${prefix}["${v_name}"]`, child_v, pts, depth + 1)
        }
    }

    
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
    
    function matchPTree(pt, prefix='window', match_record) {
        // BFS
        let q = []      // Property Path Queue
        let qc = []     // pTree Queue
        q.push([])
        qc.push(pt)

        while (qc.length) {
            let v_path = q.shift()
            let cur_node = qc.shift()

            v_str = prefix
            for (let v of v_path) {
                v_str += `["${v}"]`
            }

            for (let _dict of cur_node['d']) {
                if (eval(`compare_Dict_V (_dict['d'], ${v_str})`)) {
                    for (let lib_info of _dict['Ls']) {
                        file_id = lib_info['F']
                        credit1 = lib_info['x']
                        if (match_record.hasOwnProperty(file_id)) {
                            match_record[file_id]['credit1'] += credit1
                            match_record[file_id]['matched'] += 1
                        }
                        else {
                            match_record[file_id] = {'credit1': credit1, 'matched': 1}
                        }
                    }
                }
            }

            v_prop = eval(`Object.keys(${v_str})`)
            for (let child of cur_node['c']) {
                if (v_prop.includes(child['n'])) {
                    q.push([...v_path])              // shallow copy
                    q[q.length - 1].push(child['n'])
                    qc.push(child)
                }
            }             

        }
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
                    let vlist = Object.keys(window)
                    vlist = vlist.filter(val => !orig.includes(val));

                    keywords = [];
                    for (let v of vlist) {
                        findKeywords('window', v, pts, 1);      // NEED CHANGE HERE
                    }
                    console.log(`Detected keywords' number: ${keywords.length}`)
                    console.log(keywords);

                    // Calculate the credit for each library
                    let match_record = {}
                    for (let keyword of keywords) {
                        let v_name = keyword[0]
                        let v_prefix = keyword[1]
                        let pt = pts[v_name]
                        matchPTree(pt, v_prefix, match_record)
                    }

                        
                    console.log(`Credit table: ({lib: {index: {node_number: xx, credit: xx} ... } ... })`)
                    console.log(match_record)

                    // Sort the result based on credit score
                    let result_table = []
                    for (let lib_name in credit_table) {
                        let scores = credit_table[lib_name]
                        let total_score = 0
                        let matched_node_num = 0
                        let match_path = []
                        for (let st_index in scores) {
                            total_score += scores[st_index]['credit']
                            matched_node_num += scores[st_index]['node_number']
                            match_path.push(scores[st_index]['match_path'])
                        }
                        result_table.push({'lib': lib_name, 'score': total_score.toFixed(1), 'matched node': matched_node_num, 'match path': match_path})
                    }
                    result_table.sort((a, b) => b['score']-a['score'])
                    console.log(`Detected libraries' number: ${result_table.length}`)
                    console.log(result_table)


                    let result_table2 = []
                    for (let result of result_table) {
                        if (result['score'] >= 50 && result['matched node'] >= 5) {
                            result_table2.push(result)
                        }
                    }
                    console.log(result_table2)

                })

        }


    });
})();
