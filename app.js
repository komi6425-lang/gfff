/* BZM — app.js (Realtime Database version)
   Uses Firebase Realtime Database.
   Admin password injected: zino#mouloud#sofyan#
*/
const ADMIN_EMAIL = "mzi935520@gmail.com";
const ADMIN_PASSWORD = "zino#mouloud#sofyan#";

const firebaseConfig = {
  apiKey: "AIzaSyDs7ChIRz7EqsDUznktbK8UktYltvesExo",
  authDomain: "bzm-app-4bac2.firebaseapp.com",
  projectId: "bzm-app-4bac2",
  storageBucket: "bzm-app-4bac2.firebasestorage.app",
  messagingSenderId: "939539897090",
  appId: "1:939539897090:web:6308a448ca735a91e7801b",
  databaseURL: "https://bzm-ts-default-rtdb.firebaseio.com/"
};

// utilities
function sanitizeEmail(e){ return (e||'').trim().toLowerCase().replace(/\./g,'_'); } // replace dots for keys
function rawEmailFromKey(k){ return (k||'').replace(/_/g,'.'); }
function setCurrentEmail(e){ if(e) localStorage.setItem('bzm_current', e); else localStorage.removeItem('bzm_current'); }
function currentEmail(){ return localStorage.getItem('bzm_current'); }
function show(id){ document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden')); const el=document.getElementById(id); if(el) el.classList.remove('hidden'); }

// init firebase (assumes compat scripts loaded in index.html)
if(window.firebase && !firebase.apps.length){
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// translations (kept minimal)
const TRANSLATIONS = { en:{ login:"Login", createAccount:"Create Account (Buy card)", chooseCard:"Choose card type", simulatePay:"Proceed to PayPal", userDashboard:"User Dashboard", yourCards:"Your Cards", requestBonus:"Request Bonus", logout:"Logout", adminPanel:"Admin Panel", prices:"Prices", bonuses:"Bonuses (amount)", paypal:"PayPal", saveSettings:"Save Settings", createFree:"Create Free User & Grant N Cards", generate:"Generate Codes", pending:"Pending Bonus Requests", usersCodes:"Users & Codes", footer:"© BZM", fullName:"Full Name", email:"Email", passwordPH:"Password", referral:"Referral Code (required to buy)", yourPrice:"Your price", yourBonus:"Your bonus" }, ar:{ login:"تسجيل الدخول", createAccount:"إنشاء حساب (شراء بطاقة)", chooseCard:"اختر نوع البطاقة", simulatePay:"الدفع عبر بايبال", userDashboard:"لوحة المستخدم", yourCards:"بطاقاتك", requestBonus:"طلب مكافأة", logout:"تسجيل الخروج", adminPanel:"لوحة الأدمن", prices:"الأسعار", bonuses:"المكافآت (المبلغ)", paypal:"بايبال", saveSettings:"حفظ الإعدادات", createFree:"إنشاء مستخدم مجاني ومنحه N بطاقات", generate:"توليد أكواد", pending:"طلبات المكافآت المعلقة", usersCodes:"المستخدمون & الأكواد", footer:"© BZM — تجربة محلية", fullName:"الاسم الكامل", email:"البريد الإلكتروني", passwordPH:"كلمة المرور", referral:"كود الإحالة (مطلوب)", yourPrice:"سعرُك", yourBonus:"مكافأتك" } };
let CURRENT_LANG = localStorage.getItem('bzm_lang') || 'en';
function applyTranslations(){ const t = TRANSLATIONS[CURRENT_LANG]||TRANSLATIONS.en; if(document.getElementById('txt-login')) document.getElementById('txt-login').innerText=t.login; if(document.getElementById('pay-btn')) document.getElementById('pay-btn').innerText='طلب إنشاء الحساب'; if(document.getElementById('txt-footer')) document.getElementById('txt-footer').innerText=t.footer; if(document.getElementById('reg-name')) document.getElementById('reg-name').placeholder=t.fullName; if(document.getElementById('reg-email')) document.getElementById('reg-email').placeholder=t.email; if(document.getElementById('reg-pass')) document.getElementById('reg-pass').placeholder=t.passwordPH; if(document.getElementById('reg-ref')) document.getElementById('reg-ref').placeholder=t.referral; if(CURRENT_LANG==='ar') document.documentElement.dir='rtl'; else document.documentElement.dir='ltr'; }

// ensure defaults
async function ensureDefaultsRealtime(){
  const ref = db.ref('settings/main');
  const snap = await ref.once('value');
  if(!snap.exists()){
    await ref.set({
      prices: { diamond:200, gold:100, silver:50 },
      bonuses: { diamond:600, gold:300, silver:150 },
      paypal: '',
      paypal_urls: { diamond:'', gold:'', silver:'' },
      admin: { email: ADMIN_EMAIL, pass: ADMIN_PASSWORD }
    });
  } else {
    const data = snap.val();
    if(!data.admin){
      await ref.update({ admin: { email: ADMIN_EMAIL, pass: ADMIN_PASSWORD } });
    }
  }
  // seed user
  const usersSnap = await db.ref('users').limitToFirst(1).once('value');
  if(!usersSnap.exists()){
    const key = sanitizeEmail('seed@bzm.local');
    await db.ref('users/'+key).set({
      name:'seed', email:'seed@bzm.local', pass:'seed', cardType:'gold',
      cards:['GOLD-SEED-1','GOLD-SEED-2','GOLD-SEED-3','GOLD-SEED-4','GOLD-SEED-5'],
      referrals:0, Ref:'SEED'+Math.random().toString(36).slice(2,6).toUpperCase(), bonusRequested:false
    });
  }
}

// Realtime listeners
db.ref('settings/main').on('value', (snap)=>{
  const s = snap.val()||{};
  // update select
  const sel = document.getElementById('selected-card');
  if(sel){
    const p = (s.prices) ? s.prices : { diamond:200, gold:100, silver:50 };
    sel.innerHTML = `<option value="">Select Card</option>
      <option value="diamond">Diamond — $${p.diamond}</option>
      <option value="gold">Gold — $${p.gold}</option>
      <option value="silver">Silver — $${p.silver}</option>`;
  }
  // if user logged, refresh view
  if(currentEmail()) loadUser();
  const fld=document.getElementById('user-admin-id'); if(fld) fld.value=(s.adminGlobalId||'');
});

// helpers for users
async function getUserObjByEmailRaw(email){
  const key = sanitizeEmail(email);
  const snap = await db.ref('users/'+key).once('value');
  return snap.exists()? snap.val() : null;
}
async function saveUserObj(user){
  const key = sanitizeEmail(user.email);
  await db.ref('users/'+key).set(user);
}

// generate cards
function generateCards(count,type){ const arr=[]; for(let i=0;i<count;i++) arr.push(`${type.toUpperCase()}-${Math.random().toString(36).slice(2,9).toUpperCase()}`); return arr; }

/* Create account request — no payment */
async function registerOpenPay(){
  const name = (document.getElementById('reg-name').value||'').trim();
  const email = (document.getElementById('reg-email').value||'').trim();
  const pass = (document.getElementById('reg-pass').value||'').trim();
  const ref  = (document.getElementById('reg-ref').value||'').trim();
  const redotpay = (document.getElementById('reg-redotpay')?.value||'').trim();
  const card = document.getElementById('selected-card').value;

  if(!name||!email||!pass||!card)
    return alert('املأ جميع الحقول');

  const q = await db.ref('users').orderByChild('Ref').equalTo(ref).once('value');
  if(!q.exists()){
    return alert('كود الإحالة غير موجود');
  }

  const key = sanitizeEmail(email);
  await db.ref('account_requests/'+key).set({ redotpay,
    name,email,pass,cardType:card,ref,createdAt:Date.now()
  });

  alert('تم إرسال طلب إنشاء الحساب — بانتظار موافقة الأدمن');
  show('auth-screen');
}

// UI and admin functions
async function loadAdmin(){
  const snap = await db.ref('settings/main').once('value');
  const s = snap.val() || {};
  document.getElementById('price-diamond').value = s.prices? s.prices.diamond : 200;
  document.getElementById('price-gold').value   = s.prices? s.prices.gold : 100;
  document.getElementById('price-silver').value = s.prices? s.prices.silver : 50;
  document.getElementById('bonus-diamond').value = s.bonuses? s.bonuses.diamond : 600;
  document.getElementById('bonus-gold').value   = s.bonuses? s.bonuses.gold : 300;
  document.getElementById('bonus-silver').value = s.bonuses? s.bonuses.silver : 150;
  document.getElementById('paypal-client').value = s.paypal || '';
  document.getElementById('paypal-silver-url').value = (s.paypal_urls && s.paypal_urls.silver)? s.paypal_urls.silver : '';
  document.getElementById('paypal-gold-url').value = (s.paypal_urls && s.paypal_urls.gold)? s.paypal_urls.gold : '';
  document.getElementById('paypal-diamond-url').value = (s.paypal_urls && s.paypal_urls.diamond)? s.paypal_urls.diamond : '';
  document.getElementById('admin-global-id').value = s.adminGlobalId || '';
  await renderBonusRequests(); await renderUsersCodes();
}

document.addEventListener('click', (e)=>{
  if(e.target && e.target.id === 'save-admin'){
    (async ()=>{
      try{
        const sSnap = await db.ref('settings/main').once('value'); const s = sSnap.val() || {};
        s.prices = s.prices || {};
        s.prices.diamond = Number(document.getElementById('price-diamond').value) || s.prices.diamond;
        s.prices.gold = Number(document.getElementById('price-gold').value) || s.prices.gold;
        s.prices.silver = Number(document.getElementById('price-silver').value) || s.prices.silver;
        s.bonuses = s.bonuses || {};
        s.bonuses.diamond = Number(document.getElementById('bonus-diamond').value) || s.bonuses.diamond;
        s.bonuses.gold = Number(document.getElementById('bonus-gold').value) || s.bonuses.gold;
        s.bonuses.silver = Number(document.getElementById('bonus-silver').value) || s.bonuses.silver;
        s.paypal = document.getElementById('paypal-client').value || s.paypal || '';
        s.paypal_urls = s.paypal_urls || {};
        s.paypal_urls.silver = document.getElementById('paypal-silver-url').value || s.paypal_urls.silver || '';
        s.paypal_urls.gold = document.getElementById('paypal-gold-url').value || s.paypal_urls.gold || '';
        s.paypal_urls.diamond = document.getElementById('paypal-diamond-url').value || s.paypal_urls.diamond || '';
        await db.ref('settings/main').set(s);
        alert('Settings saved ✅');
      }catch(err){ console.error(err); alert('Error saving settings: '+err); }
    })();
  }
});

// admin create free user
document.addEventListener('click', (e)=>{
  if(e.target && e.target.id === 'admin-create-free'){
    (async ()=>{
      try{
        const name = document.getElementById('admin-free-name').value.trim();
        const email = (document.getElementById('admin-free-email').value||'').trim();
        const pass = document.getElementById('admin-free-pass').value.trim() || Math.random().toString(36).slice(2,8);
        const cardType = document.getElementById('admin-free-card').value;
        const count = Number(document.getElementById('admin-free-count').value) || 5;
        if(!name||!email) return alert('Enter name and email');
        const existing = await getUserObjByEmailRaw(email);
        if(existing) return alert('Email already exists');
        const cards = generateCards(count, cardType);
        await saveUserObj({ name, email, pass, cardType, cards, referrals:0, Ref: Math.random().toString(36).slice(2,10).toUpperCase(), bonusRequested:false });
        alert(`Created: ${email} — ${count} ${cardType}`);
        document.getElementById('admin-free-name').value=''; document.getElementById('admin-free-email').value=''; document.getElementById('admin-free-pass').value=''; document.getElementById('admin-free-count').value='5';
        await renderBonusRequests(); await renderUsersCodes();
      }catch(err){ console.error(err); alert('Error creating free user: '+err); }
    })();
  }
});

// generate codes
document.addEventListener('click', (e)=>{
  if(e.target && e.target.id === 'gen-btn'){
    (async ()=>{
      try{
        const email = (document.getElementById('gen-email').value||'').trim();
        const type = document.getElementById('gen-type').value;
        const count = Number(document.getElementById('gen-count').value) || 5;
        const u = await getUserObjByEmailRaw(email);
        if(!u) return alert('User not found');
        u.cards = u.cards || [];
        u.cards.push(...generateCards(count,type));
        await saveUserObj(u);
        alert(`${count} cards generated for ${email}`);
        await renderBonusRequests(); await renderUsersCodes();
      }catch(err){ console.error(err); alert('Error generating codes: '+err); }
    })();
  }
});

// render bonus requests
async function renderBonusRequests(){
  const box = document.getElementById('bonus-requests');
  if(!box) return;
  box.innerHTML = '';
  const usersSnap = await db.ref('users').once('value');
  const users = usersSnap.exists()? usersSnap.val() : {};
  Object.values(users).filter(u=>u.bonusRequested).forEach(u=>{
    const div = document.createElement('div'); div.className='user-block';
    let codesHtml = '<div class="user-codes">'+((u.cards&&u.cards.length)? u.cards.join('<br>') : '(no codes)') + '</div>';
    div.innerHTML = `<div style="margin-bottom:6px"><strong>${u.name}</strong> — ${u.email}</div><div><strong>PayPal:</strong> ${u.paypalEmail || '—'} — ${u.cardType || 'N/A'}</div> ${codesHtml} <div style="margin-top:8px"> <button class="admin-pay" data-email="${u.email}">Pay Reward</button> <button class="admin-reject" data-email="${u.email}">Reject</button></div>`;
    box.appendChild(div);
  });
  box.querySelectorAll('.admin-pay').forEach(b=>b.addEventListener('click', async ()=>{
    const email = b.getAttribute('data-email'); const u = await getUserObjByEmailRaw(email); if(!u) return;
    u.referrals = 0; u.bonusRequested = false; await saveUserObj(u); await renderBonusRequests(); await renderUsersCodes(); alert('Bonus manually paid.');
  }));
  box.querySelectorAll('.admin-reject').forEach(b=>b.addEventListener('click', async ()=>{ const email=b.getAttribute('data-email'); const u=await getUserObjByEmailRaw(email); if(!u) return; u.bonusRequested=false; await saveUserObj(u); await renderBonusRequests(); alert('Rejected'); }));
}

// render users & codes

async function renderAccountRequests(){
  const box = document.getElementById('account-requests');
  if(!box) return;
  box.innerHTML = '';

  const snap = await db.ref('account_requests').once('value');
  const reqs = snap.exists()? snap.val() : {};

  Object.values(reqs).forEach(r=>{
    const div = document.createElement('div');
    div.className='user-block';
    div.innerHTML = `
      <strong>${r.name}</strong> — ${r.email}<br>
      Card: ${r.cardType}<br>
      Ref: ${r.ref || '—'}
      <div style="margin-top:8px">
        <button class="req-approve" data-email="${r.email}">قبول وإنشاء الحساب</button>
        <button class="req-reject" data-email="${r.email}">رفض</button>
      </div>
    `;
    box.appendChild(div);
  });

  box.querySelectorAll('.req-approve').forEach(btn=>btn.onclick = async ()=>{
    const email = btn.getAttribute('data-email');
    const key = sanitizeEmail(email);
    const snap = await db.ref('account_requests/'+key).once('value');
    if(!snap.exists()) return;

    const r = snap.val();
    const cards = generateCards(5, r.cardType);

    await saveUserObj({
      name:r.name,email:r.email,pass:r.pass,
      cardType:r.cardType,cards,referrals:0, redotpay: r.redotpay || '',
      Ref: Math.random().toString(36).slice(2,10).toUpperCase(),
      bonusRequested:false
    });

    // احتساب الإحالة بعد قبول الحساب
if(r.ref){
  const q2 = await db.ref('users').orderByChild('Ref').equalTo(r.ref).once('value');
  if(q2.exists()){
    const k2 = Object.keys(q2.val())[0];
    const refUser2 = q2.val()[k2];
    refUser2.referrals = (refUser2.referrals || 0) + 1;
    await saveUserObj(refUser2);
  }
}
// REFERRAL_INCREMENT_ON_APPROVE
        await db.ref('account_requests/'+key).remove();
    alert('تم إنشاء الحساب وقبول الطلب');
    await renderAccountRequests(); await renderUsersCodes();
  });

  box.querySelectorAll('.req-reject').forEach(btn=>btn.onclick = async ()=>{
    const email = btn.getAttribute('data-email');
    const key = sanitizeEmail(email);
    // احتساب الإحالة بعد قبول الحساب
if(r.ref){
  const q2 = await db.ref('users').orderByChild('Ref').equalTo(r.ref).once('value');
  if(q2.exists()){
    const k2 = Object.keys(q2.val())[0];
    const refUser2 = q2.val()[k2];
    refUser2.referrals = (refUser2.referrals || 0) + 1;
    await saveUserObj(refUser2);
  }
}
// REFERRAL_INCREMENT_ON_APPROVE
        await db.ref('account_requests/'+key).remove();
    alert('تم رفض الطلب');
    await renderAccountRequests();
  });
}
async function renderUsersCodes(){
  const box = document.getElementById('users-codes');
  if(!box) return;
  box.innerHTML = '';
  const usersSnap = await db.ref('users').once('value');
  const users = usersSnap.exists()? usersSnap.val() : {};
  Object.values(users).forEach(u=>{
    const div = document.createElement('div'); div.className='user-block';
    let codesHtml = (u.cards && u.cards.length) ? '<div class="user-codes">'+u.cards.join('<br>')+'</div>' : '<div class="user-codes">(no codes)</div>';
    div.innerHTML = `<strong>${u.name}</strong> — ${u.email}</div><div><strong>PayPal:</strong> ${u.paypalEmail || '—'} <br> Ref: ${u.Ref || '—'}<br> Type: ${u.cardType || '—'} <br> RedotPay: ${u.redotpay || '—'} <br> ${codesHtml}`;
    box.appendChild(div);
  });
}

// user view
async function loadUser(){
  const cur = currentEmail();
  const u = cur ? await getUserObjByEmailRaw(cur) : null;
  if(!u){ show('auth-screen'); return; }
  const sSnap = await db.ref('settings/main').once('value');
  const s = sSnap.val() || {};
  const price = (s.prices && s.prices[u.cardType])? s.prices[u.cardType] : 0;
  const bonus = (s.bonuses && s.bonuses[u.cardType])? s.bonuses[u.cardType] : 0;
  const t = TRANSLATIONS[CURRENT_LANG] || TRANSLATIONS.en;
  if(document.getElementById('user-price')) document.getElementById('user-price').innerText = `${t.yourPrice}: ${price}$`;
  if(document.getElementById('user-bonus')) document.getElementById('user-bonus').innerText = `${t.yourBonus}: ${bonus}$`;
  if(document.getElementById('user-redotpay')) document.getElementById('user-redotpay').innerText = u.redotpay || '—';
  if(document.getElementById('user-referrals')) document.getElementById('user-referrals').innerText = `Referrals: ${u.referrals || 0} / 5`;
  if(document.getElementById('user-refcode')) document.getElementById('user-refcode').innerText = u.Ref || '—';
  const cardsEl = document.getElementById('user-cards'); if(cardsEl){ cardsEl.innerHTML=''; (u.cards||[]).forEach(c=>{ const d=document.createElement('div'); d.className='card-pill'; d.innerText=c; cardsEl.appendChild(d); }); }
  // copy button
  if(!document.getElementById('copy-ref-btn')){ const cb=document.createElement('button'); cb.id='copy-ref-btn'; cb.className='btn'; cb.style.marginLeft='8px'; cb.style.display='inline-block'; cb.innerText=(CURRENT_LANG==='ar')? 'نسخ' : 'Copy'; const refEl=document.getElementById('user-refcode'); if(refEl && refEl.parentNode) refEl.parentNode.appendChild(cb); cb.addEventListener('click', ()=>{ navigator.clipboard && navigator.clipboard.writeText(refEl.innerText); alert((CURRENT_LANG==='ar')? 'تم نسخ كود الإحالة' : 'Referral code copied'); }); }
  const btn = document.getElementById('request-bonus-btn'); if(btn){ btn.onclick = async ()=>{ let paypalEmail = prompt(TRANSLATIONS[CURRENT_LANG].bonusPrompt); if(!paypalEmail){ alert("You must enter your PayPal email."); return; } u.paypalEmail = paypalEmail; if((u.referrals||0) < 5){ alert('You must have 5 referrals to request the bonus.'); return; } u.bonusRequested = true; await saveUserObj(u); alert(TRANSLATIONS[CURRENT_LANG].bonusSent); show('user-screen'); }; }
  show('user-screen');
}

// update select pricing
function updateCardPricesInSelect(){ db.ref('settings/main').once('value').then(snap=>{ const s=snap.val()||{}; const p=s.prices||{diamond:200,gold:100,silver:50}; const sel=document.getElementById('selected-card'); if(sel) sel.innerHTML=`<option value="">Select Card</option><option value="diamond">Diamond — $${p.diamond}</option><option value="gold">Gold — $${p.gold}</option><option value="silver">Silver — $${p.silver}</option>`; }).catch(e=>console.error(e)); }

// title admin clicks
let adminClicks=0;
const title=document.getElementById('app-title');
if(title){
  title.addEventListener('click', ()=>{ adminClicks++; clearTimeout(window._bzm_admin_timer); window._bzm_admin_timer=setTimeout(()=>{ adminClicks=Math.max(0,adminClicks-1); },3000); if(adminClicks>=20){ adminClicks=0; (async ()=>{ const pass=prompt('Enter admin password:'); try{ const sSnap = await db.ref('settings/main').once('value'); const adminObj = (sSnap.exists() && sSnap.val().admin) ? sSnap.val().admin : {email:ADMIN_EMAIL, pass:ADMIN_PASSWORD}; if(pass && pass.trim()===adminObj.pass){ await loadAdmin(); show('admin-screen'); } else { alert('Wrong password'); } }catch(e){ if(pass && pass.trim()===ADMIN_PASSWORD){ await loadAdmin(); show('admin-screen'); } else alert('Wrong password'); } })(); } }); }

// logout
document.addEventListener('click',(e)=>{ if(e.target && e.target.id==='logout-btn'){ setCurrentEmail(null); show('auth-screen'); } });

// login & pay handlers
document.addEventListener('click',(e)=>{ if(e.target && e.target.id==='login-btn') loginHandler(); if(e.target && e.target.id==='pay-btn') registerOpenPay(); });

// login function
async function loginHandler(){ const email=(document.getElementById('login-email').value||'').trim(); const pass=(document.getElementById('login-pass').value||''); if(!email||!pass) return alert('Login failed'); const u = await getUserObjByEmailRaw(email); if(!u || u.pass !== pass) return alert('Login failed'); setCurrentEmail(u.email); await loadUser(); }

// boot
async function boot(){ try{ await ensureDefaultsRealtime(); applyTranslations(); updateCardPricesInSelect(); const cur=currentEmail(); if(cur){ const exists=await getUserObjByEmailRaw(cur); if(exists) await loadUser(); else show('auth-screen'); } else show('auth-screen'); }catch(err){ console.error('Boot failed',err); alert('Initialization failed: '+err); } }

boot();


// language selector fix
document.addEventListener('change', (e)=>{
  if(e.target && e.target.id==='lang-select'){
    CURRENT_LANG = e.target.value;
    localStorage.setItem('bzm_lang', CURRENT_LANG);
    applyTranslations();
  }
});

// close admin fix
document.addEventListener('click',(e)=>{
  if(e.target && e.target.id==='admin-logout'){
    show('auth-screen');
  }
});

// Admin set / update RedotPay ID
document.addEventListener('click', (e)=>{
  if(e.target && e.target.id === 'admin-set-redotpay-btn'){
    (async ()=>{
      try{
        const email = (document.getElementById('admin-set-redotpay-email').value||'').trim();
        const rid = (document.getElementById('admin-set-redotpay-id').value||'').trim();
        if(!email) return alert('Enter user email');
        const u = await getUserObjByEmailRaw(email);
        if(!u) return alert('User not found');
        u.redotpay = rid;
        await saveUserObj(u);
        alert('RedotPay ID saved');
        await renderUsersCodes();
      }catch(err){ alert('Error: '+err); }
    })();
  }
});
