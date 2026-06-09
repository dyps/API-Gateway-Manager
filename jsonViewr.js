
function newJsonViewr(container, path) {
    if (Array.isArray(path)) {

        for (let i = 0; i < path.length; i++) {
            if (typeof path[i] === "object") {
                if (Array.isArray(path[i])) {
                    console.log("falta impl")
                }else {

                    var divMain = document.createElement("div");

                    var div = document.createElement("div");

                    var divObject = document.createElement("div");
                    divObject.classList.add("hidden", "divObject")
                    divMain.appendChild(div);
                    divMain.appendChild(divObject);
                    var preInfo = document.createElement("span");
                    preInfo.textContent = getTextInfo(path[i], false,  i + " : ");//colocar prefix
                    preInfo.classList.add("info")

                    createObjectEditor(div, divObject, preInfo, path[i], i + " : ")

                    div.appendChild(preInfo);

                    container.appendChild(divMain);

                }
            }else{
                var div = document.createElement("div")
                div.classList.add("divObject")
                var value = document.createElement("span");
                value.textContent = " " + JSON.stringify(path[i])
                if(i > 1){
                    value.textContent += ", "
                }
                value.classList.add("value")
                div.appendChild(value);
                container.appendChild(div);
            }
        }
    } else {
        var keysPaths = Object.keys(path)


        for (let i = 0; i < keysPaths.length; i++) {

            var divMain = document.createElement("div");

            var div = document.createElement("div");

            var divObject = document.createElement("div");
            divObject.classList.add("hidden", "divObject")

            divMain.appendChild(div);
            divMain.appendChild(divObject);

            var preInfo = document.createElement("span");
            preInfo.textContent = getTextInfo(path[keysPaths[i]], false);
            preInfo.classList.add("info")

            if (typeof path[keysPaths[i]] === "object") {
                createObjectEditor (div, divObject, preInfo, path[keysPaths[i]], "")
            }

            var prePath = document.createElement("span");
            prePath.textContent = JSON.stringify(keysPaths[i]);//hire
            div.appendChild(prePath);

            
            div.appendChild(preInfo);



            if (typeof path[keysPaths[i]] !== "object") {
                var value = document.createElement("span");
                value.textContent = " " + JSON.stringify(path[keysPaths[i]]);
                div.classList.add("value");
                div.appendChild(value);
            } 
            container.appendChild(divMain);
        }
    }

}


function createObjectEditor (div, divObject, preInfo, obj, prefixInfo){
    const btn = document.createElement("span");
    btn.textContent = " > ";
    btn.classList.add("action")
    btn.onclick = () => {
        btn.classList.add("hidden")
        btn2.classList.remove("hidden")
        divObject.classList.remove("hidden")
        loadChildren()
        preInfo.textContent = getTextInfo(obj, true, prefixInfo);
    }
    const btn2 = document.createElement("span");
    btn2.textContent = " v ";
    btn2.classList.add("action", "hidden")
    btn2.onclick = () => {
        btn.classList.remove("hidden")
        btn2.classList.add("hidden")
        divObject.classList.add("hidden")
        preInfo.textContent = getTextInfo(obj, false, prefixInfo);
    }
    div.appendChild(btn);
    div.appendChild(btn2);

    let childrenLoaded = false;

    // Função para carregar os filhos
    const loadChildren = () => {
        if (!childrenLoaded) {
            newJsonViewr(divObject, obj);
            childrenLoaded = true;
            
            const posInfo = document.createElement("span");
            if (Array.isArray(obj)) {
                posInfo.textContent = "]";
            } else {
                posInfo.textContent = "}";
            }
            posInfo.classList.add("info")
            divObject.appendChild(posInfo);
        }
    }
}

function getTextInfo(obj, open, prefix) {
    if (prefix == undefined){
        prefix = ""
    }
    
    if (typeof obj === "object") {
        var textContent = prefix;
        if (Array.isArray(obj)) {
            textContent += " [ " + obj.length + " itens"
            if(!open){ 
                textContent += "]"
            }
        } else {
            textContent += " { "
            if(!open){ 
                textContent += Object.keys(obj).length + " itens }"
            }
        }
        return textContent;
    }


    return " : ";
}
