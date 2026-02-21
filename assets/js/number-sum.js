(function(){

  function $(id){
    return document.getElementById(id);
  }

  const elInput = $("numbersInput");
  const elOutput = $("sumOutput");
  const elErr = $("err");

  const btnExample = $("btn-example-2");
  const btnClear = $("btn-clear-2");
  const btnPaste = $("btn-paste-2");
  const btnCopy = $("btn-copy");
  const btnDownload = $("btn-download");

  if(!elInput || !elOutput) return;

let errTimer = null;

function showError(show){
  if(!elErr) return;

  if(errTimer){
    clearTimeout(errTimer);
    errTimer = null;
  }

  if(show){
    elErr.classList.add("show");

    errTimer = setTimeout(()=>{
      elErr.classList.remove("show");
    }, 2000);
  }else{
    elErr.classList.remove("show");
  }
}


  function tokenize(text){
    return (text || "")
      .replace(/\r/g, "\n")
      .replace(/,/g, " ")
      .split(/\s+/)
      .map(t => t.trim())
      .filter(Boolean);
  }

  function update(){
    showError(false);

    const tokens = tokenize(elInput.value);

    if(tokens.length === 0){
      elOutput.value = "";
      return;
    }

    let sum = 0;

    for(let i = 0; i < tokens.length; i++){
      const n = Number(tokens[i]);
      if(!Number.isFinite(n)){
        elOutput.value = "";
        showError(true);
        return;
      }
      sum += n;
    }

    elOutput.value = String(sum);
  }

  async function pasteFromClipboard(){
    try{
      const txt = await navigator.clipboard.readText();
      if(txt != null) elInput.value = txt;
      update();
    }catch(e){
      showError(true);
    }
  }

  async function copyOutput(){
    try{
      await navigator.clipboard.writeText(elOutput.value || "");
    }catch(e){
      showError(true);
    }
  }

  function downloadOutput(){
    const blob = new Blob([elOutput.value || ""], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "sum.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  elInput.addEventListener("input", update);

  if(btnExample){
    btnExample.addEventListener("click", function(){
      elInput.value = "0\n1\n20\n33\n400\n505\n660\n777\n8008\n9090";
      update();
    });
  }

  if(btnClear){
    btnClear.addEventListener("click", function(){
      elInput.value = "";
      elOutput.value = "";
      showError(false);
      elInput.focus();
    });
  }

  if(btnPaste){
    btnPaste.addEventListener("click", function(){
      pasteFromClipboard();
    });
  }

  if(btnCopy){
    btnCopy.addEventListener("click", function(){
      copyOutput();
    });
  }

  if(btnDownload){
    btnDownload.addEventListener("click", function(){
      downloadOutput();
    });
  }

  update();

})();
