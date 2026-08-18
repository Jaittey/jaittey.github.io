
window.addEventListener('DOMContentLoaded',()=>{
 const email=document.querySelector('#email'),pass=document.querySelector('#password'),msg=document.querySelector('#loginMsg');
 document.querySelector('#googleLogin').onclick=async()=>{try{await SBAuth.loginGoogle()}catch(e){msg.textContent=e.message}};
 document.querySelector('#emailLogin').onclick=async()=>{try{await SBAuth.loginEmail(email.value,pass.value)}catch(e){msg.textContent=e.message}};
 document.querySelector('#emailRegister').onclick=async()=>{try{await SBAuth.registerEmail(email.value,pass.value)}catch(e){msg.textContent=e.message}};
});
