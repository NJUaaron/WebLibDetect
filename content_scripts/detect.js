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
    function findKeywords(prefix, v_name, sts_index, depth) {
        // st_index @: subtrees_index dict     
        if (depth > 3) return;
        if (hasSameAddr(prefix, v_name)) return;
        if (sts_index.hasOwnProperty(v_name)) {
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
            findKeywords(`${prefix}["${v_name}"]`, child_v, sts_index, depth + 1)
        }
    }

    
    function compare_Node_V (node, v) {
        if (!node) return false;
        if (v == undefined) {
            if (node['d']['t'] == 1) return true;
            else return false;
        }
        if (v == null) {
            if (node['d']['t'] == 2) return true;
            else return false;
        }
        if (Array.isArray(v)) {
            if (node['d']['t'] == 3 && node['d']['v'] == v.length) return true;
            else return false;
        }
        if (typeof (v) == 'string') {
            if (node['d']['t'] == 4 && node['d']['v'] == v.slice(0, 10)) return true;
            else return false;
        }
        if (typeof (v) == 'object') {
            if (node['d']['t'] == 5) return true;
            else return false;
        }
        if (typeof (v) == 'function') {
            if (node['d']['t'] == 6) return true;
            else return false;        
        }
        if (typeof (v) == 'number') {
            if (node['d']['t'] == 7 && node['d']['v'] == v.toFixed(2)) return true;
            else return false;
        }
        // Other condition
        if (node['d']['t'] == typeof (v)) return true;
        else return false;
    }
    
    function MatchCredit(node, prefix) {
        // Return total credit and traversed node number
        let v = `${prefix}["${node["n"]}"]`
        // console.log(v)
        if (!eval(`compare_Node_V (node, ${v})`)) {
            return [0, 0]
        }
        let x = node['x']
        let node_num = 1
        for (c of node['c']) {
            let [_x, _node_num] = MatchCredit(c, v)
            x += _x
            node_num += _node_num
        }
        return [x, node_num]
    }

    /**
     * Listen for messages from the content script.
     */
    var tree;
    window.addEventListener("message", function (event) {
        if (event.data.type == 'detect') {
            let requests = event.data.urls.map((url) => {
                return fetch(url).then((response) => {
                    return response.json()})
            });
            Promise.all(requests)
                .then((results) => {
                    let orig = results[0]
                    let sts_index = results[1]
                    let sts = results[2]

                    // Find all keywords in the web object tree
                    let vlist = Object.keys(window)
                    vlist = vlist.filter(val => !orig.includes(val));

                    keywords = [];
                    for (let v of vlist) {
                        findKeywords('window', v, sts_index, 1);
                    }
                    console.log(`Detected keywords' number: ${keywords.length}`)
                    console.log(keywords);

                    // Calculate the credit for each library
                    let credit_table = {}
                    for (let keyword of keywords) {
                        let v_name = keyword[0]
                        let v_prefix = keyword[1]
                        let st_index_list = sts_index[v_name]
                        for (let st_index of st_index_list) {
                            let index = st_index['tree_index']
                            let lib_name = st_index['lib']
                            if (!credit_table.hasOwnProperty(lib_name)) {
                                // Initialize a new entry for the lib
                                credit_table[lib_name] = {}
                            }
                            let matchtree = sts[index]
                            let [credit, node_num] = MatchCredit(matchtree, v_prefix)
                            if (credit_table[lib_name].hasOwnProperty(index)) {
                                // The subtree has already been calculated
                                let old_credit = credit_table[lib_name][index][credit]
                                if (credit > old_credit) {
                                    // Update the higher credit one
                                    credit_table[lib_name][index] = {"node_number": node_num, "credit": credit, "match_path": `${v_prefix}["${matchtree["n"]}"]`}
                                }
                            }
                            else {
                                credit_table[lib_name][index] = {"node_number": node_num, "credit": credit, "match_path": `${v_prefix}["${matchtree["n"]}"]`}
                            }
                        }   
                    }
                    console.log(`Credit table: ({lib: {index: {node_number: xx, credit: xx} ... } ... })`)
                    console.log(credit_table)

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
