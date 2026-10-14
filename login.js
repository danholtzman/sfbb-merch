// Demonstration only: production must authenticate and authorize on the server.
const demoAccounts={user:{password:'band2026',role:'member'},admin:{password:'admin2026',role:'admin'}};
let sessionRole=sessionStorage.getItem('sfbb-demo-role');
if(!['member','admin'].includes(sessionRole))sessionRole=null;
function renderSession(){
 $('#login-view').hidden=!!sessionRole;$('#app-shell').hidden=!sessionRole;
 $('#admin-nav').hidden=sessionRole!=='admin';
 if(!sessionRole)return;
 if(sessionRole==='admin'&&!window.matchMedia('(max-width: 600px)').matches){$('#admin-nav').click();adminTab('orders');}
 else showShop();
}
$('#login-form').onsubmit=e=>{
 e.preventDefault();
 const username=$('#login-username').value.trim().toLowerCase(),password=$('#login-password').value,account=demoAccounts[username];
 if(!account||account.password!==password){$('#login-error').hidden=false;$('#login-error').textContent='Username or password is incorrect. Please try again.';$('#login-password').focus();return;}
 sessionRole=account.role;sessionStorage.setItem('sfbb-demo-role',sessionRole);$('#login-error').hidden=true;$('#login-password').value='';$('#login-password').type='password';$('#toggle-password').textContent='Show';$('#toggle-password').setAttribute('aria-label','Show password');$('#toggle-password').setAttribute('aria-pressed','false');renderSession();
 (sessionRole==='admin'?$('#admin-nav'):$('#shop-nav')).focus();
};
$('#toggle-password').onclick=()=>{
 const show=$('#login-password').type==='password';$('#login-password').type=show?'text':'password';$('#toggle-password').textContent=show?'Hide':'Show';$('#toggle-password').setAttribute('aria-label',show?'Hide password':'Show password');$('#toggle-password').setAttribute('aria-pressed',String(show));
};
$('#logout-button').onclick=()=>{
 if($('#modal').open)$('#modal').close();closeBag();cart=[];editing=null;renderBag();sessionRole=null;sessionStorage.removeItem('sfbb-demo-role');$('#login-form').reset();$('#login-error').hidden=true;renderSession();$('#login-username').focus();
};
$('#admin-nav').addEventListener('click',e=>{if(sessionRole!=='admin'){e.preventDefault();e.stopImmediatePropagation();}},true);
$('#admin-view').addEventListener('click',e=>{if(sessionRole!=='admin'){e.preventDefault();e.stopImmediatePropagation();}},true);
renderSession();
