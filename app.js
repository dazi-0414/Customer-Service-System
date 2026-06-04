const { createApp, ref, computed, reactive, watch } = Vue

// ===== Constants =====
const TAX = 0.13
const SALE_R = 0.007
const PROF_R = 0.20
const CATS = ['电阻','电容','电感与磁珠','晶振','二、三极管','过压保护器件','其他']
const CK = 'crm_customers'
const DK = 'crm_deals'
const ORDER = ['dashboard','customers','deals','calculator']
const TITLES = {dashboard:'仪表盘',customers:'客户',deals:'成交',calculator:'提成计算器'}

// ===== Helpers =====
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function today(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function load(k,f){try{return JSON.parse(localStorage.getItem(k))||f}catch{return f}}
function calcCommission(cost,price,qty){const s=price*qty,t=cost*qty*(1+TAX),p=s-t;return{salesAmount:s,cost:t,profit:p,salesCommission:s*SALE_R,profitCommission:Math.max(p*PROF_R,0),totalCommission:s*SALE_R+Math.max(p*PROF_R,0)}}

// ===== Init =====
createApp({
  setup(){
    // ========== Tabs ==========
    const tab=ref('dashboard'),dir=ref('left'),prev=ref(null)
    const title=computed(()=>TITLES[tab.value]||'')
    function go(n){
      if(n===tab.value)return
      dir.value=ORDER.indexOf(n)>ORDER.indexOf(tab.value)?'left':'right'
      prev.value=tab.value
      tab.value=n
    }
    function pgClass(n){
      if(n===tab.value)return'now'
      if(n===prev.value)return dir.value==='left'?'left':'right'
      return'left'
    }
    function fmt(n){return'¥'+Number(n||0).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})}
    function tagIcon(t){return{意向:'📌','已成交':'✅',重点:'⭐',潜在:'🔍'}[t]||''}

    // ========== Data Load ==========
    const customers=ref(load(CK,[])),deals=ref(load(DK,[]))
    const customerSearch=ref(''),dealSearch=ref('')
    watch(customers,v=>localStorage.setItem(CK,JSON.stringify(v)),{deep:true})
    watch(deals,v=>localStorage.setItem(DK,JSON.stringify(v)),{deep:true})

    // ========== Customers ==========
    const showAddCustomer=ref(false),showCustDetail=ref(false),showDelCust=ref(false)
    const selectedCustomer=ref(null),editCustomer=ref(null)
    const emptyCustForm=()=>({name:'',contact:'',phone:'',wechat:'',email:'',address:'',tags:[],note:''})
    const custForm=reactive(emptyCustForm())

    const filteredCustomers=computed(()=>{
      const q=customerSearch.value.toLowerCase().trim()
      if(!q)return customers.value
      return customers.value.filter(c=>c.name.toLowerCase().includes(q)||c.contact?.toLowerCase().includes(q)||c.phone?.includes(q))
    })

    function openAddCustomer(){editCustomer.value=null;Object.assign(custForm,emptyCustForm());showAddCustomer.value=true}
    function toggleTag(t){const i=custForm.tags.indexOf(t);i>=0?custForm.tags.splice(i,1):custForm.tags.push(t)}
    function saveCustomer(){
      if(!custForm.name.trim()){alert('请输入客户名称');return}
      const d={name:custForm.name.trim(),contact:custForm.contact.trim(),phone:custForm.phone.trim(),wechat:custForm.wechat.trim(),email:custForm.email.trim(),address:custForm.address.trim(),tags:[...custForm.tags],note:custForm.note.trim()}
      if(editCustomer.value){Object.assign(editCustomer.value,d);editCustomer.value=null}
      else{customers.value.push({id:uid(),...d,createdAt:today()})}
      showAddCustomer.value=false
      // Auto-save deal from calculator if pending
      if(calcSavePending.value){
        calcSavePending.value=false
        const nc=customers.value[customers.value.length-1]
        const r=calcCommission(calcCost.value,calcPrice.value,calcQtyK.value*1000)
        deals.value.push({id:uid(),customerId:nc.id,customerName:nc.name,date:calcSaveDate.value,category:calcCategory.value||'其他',costPrice:calcCost.value,sellingPrice:calcPrice.value,quantity:calcQtyK.value*1000,note:calcSaveNote.value||'(来自计算器)',...r})
        go('deals')
      }
    }
    function openCustomer(c){selectedCustomer.value=c;showCustDetail.value=true}
    function editThisCustomer(){
      editCustomer.value=selectedCustomer.value
      Object.assign(custForm,{name:selectedCustomer.value.name,contact:selectedCustomer.value.contact,phone:selectedCustomer.value.phone,wechat:selectedCustomer.value.wechat,email:selectedCustomer.value.email,address:selectedCustomer.value.address,tags:[...selectedCustomer.value.tags],note:selectedCustomer.value.note})
      showCustDetail.value=false;showAddCustomer.value=true
    }
    function deleteCustomer(){
      if(!selectedCustomer.value)return
      const i=customers.value.findIndex(c=>c.id===selectedCustomer.value.id)
      if(i>=0)customers.value.splice(i,1)
      showDelCust.value=false;showCustDetail.value=false;selectedCustomer.value=null
    }
    const customerDeals=computed(()=>{
      if(!selectedCustomer.value)return[]
      return deals.value.filter(d=>d.customerId===selectedCustomer.value.id)
    })

    // ========== Deals ==========
    const dealCustomerIdx=ref(-1),dealDate=ref(today()),dealCategory=ref(''),dealCost=ref(0),dealPrice=ref(0),dealQty=ref(0),dealNote=ref('')
    const editDealId=ref(null),showAddDeal=ref(false),showDealDetail=ref(false),showDelDeal=ref(false),selectedDeal=ref(null)

    const filteredDeals=computed(()=>{
      const q=dealSearch.value.toLowerCase().trim()
      if(!q)return deals.value
      return deals.value.filter(d=>d.customerName.toLowerCase().includes(q)||d.category.toLowerCase().includes(q))
    })

    function resetDealForm(){
      dealCustomerIdx.value=-1;dealDate.value=today();dealCategory.value=''
      dealCost.value=0;dealPrice.value=0;dealQty.value=0;dealNote.value=''
      editDealId.value=null
    }

    function saveDeal(){
      if(dealCustomerIdx.value<0||dealCustomerIdx.value>=customers.value.length){alert('请选择客户');return}
      if(!dealCategory.value){alert('请选择品类');return}
      if(!dealCost.value||!dealPrice.value||!dealQty.value){alert('请填写完整信息');return}
      const c=customers.value[dealCustomerIdx.value],r=calcCommission(dealCost.value,dealPrice.value,dealQty.value)
      if(editDealId.value){
        const idx=deals.value.findIndex(d=>d.id===editDealId.value)
        if(idx>=0)Object.assign(deals.value[idx],{customerId:c.id,customerName:c.name,date:dealDate.value,category:dealCategory.value,costPrice:dealCost.value,sellingPrice:dealPrice.value,quantity:dealQty.value,note:dealNote.value,...r})
      }else{
        deals.value.push({id:uid(),customerId:c.id,customerName:c.name,date:dealDate.value,category:dealCategory.value,costPrice:dealCost.value,sellingPrice:dealPrice.value,quantity:dealQty.value,note:dealNote.value,...r})
      }
      resetDealForm()
      showAddDeal.value=false;go('deals')
    }
    function openDeal(d){selectedDeal.value=d;showDealDetail.value=true}
    function editDeal(){
      if(!selectedDeal.value)return
      const d=selectedDeal.value
      const ci=customers.value.findIndex(c=>c.id===d.customerId)
      dealCustomerIdx.value=ci>=0?ci:-1
      dealDate.value=d.date;dealCategory.value=d.category
      dealCost.value=d.costPrice;dealPrice.value=d.sellingPrice;dealQty.value=d.quantity
      dealNote.value=d.note||''
      editDealId.value=d.id
      showDealDetail.value=false;showAddDeal.value=true
    }
    function closeDealForm(){resetDealForm();showAddDeal.value=false}
    function deleteDeal(){
      if(!selectedDeal.value)return
      const i=deals.value.findIndex(d=>d.id===selectedDeal.value.id)
      if(i>=0)deals.value.splice(i,1)
      showDelDeal.value=false;showDealDetail.value=false;selectedDeal.value=null
    }
    function goAddCustomer(){showAddDeal.value=false;tab.value='customers';openAddCustomer()}

    // ========== Calculator ==========
    const calcCost=ref(0),calcPrice=ref(0),priceAuto=ref(true)
    const calcQtyK=ref(0),calcCategory=ref(''),profitMargin=ref(20)
    const marginPresets=[15,20,25,30]
    const quickQtysK=[1,10,50,100,500]

    const actualQty=computed(()=>calcQtyK.value*1000)
    const perPieceProfit=computed(()=>calcCost.value>0&&calcPrice.value>0?calcPrice.value-calcCost.value-calcCost.value*TAX:0)
    const perPieceComm=computed(()=>{
      if(calcCost.value>0&&calcPrice.value>0&&calcQtyK.value>0){
        const r=calcCommission(calcCost.value,calcPrice.value,calcQtyK.value*1000)
        return r.totalCommission/(calcQtyK.value*1000)
      }
      return 0
    })
    const result=computed(()=>{
      if(calcCost.value>0&&calcPrice.value>0&&calcQtyK.value>0)return calcCommission(calcCost.value,calcPrice.value,calcQtyK.value*1000)
      return null
    })

    // Auto-calc price when cost or margin changes
    watch(calcCost,(n)=>{if(n>0&&priceAuto.value){const m=profitMargin.value/100;calcPrice.value=Math.round(n*1.13*(1+m)*10000)/10000}})
    watch(profitMargin,(m)=>{if(calcCost.value>0&&priceAuto.value){const p=m/100;calcPrice.value=Math.round(calcCost.value*1.13*(1+p)*10000)/10000}})

    // Current margin display (auto or manual)
    const currentMargin=computed(()=>{
      if(priceAuto.value&&calcCost.value>0&&calcPrice.value>0)return profitMargin.value
      if(calcCost.value>0&&calcPrice.value>0)return Math.round((calcPrice.value/calcCost.value/1.13-1)*1000)/10
      return 0
    })

    // Save from calculator
    const showCalcSave=ref(false),calcSaveIdx=ref(-1),calcSavePending=ref(false),calcSaveDate=ref(today()),calcSaveNote=ref('')
    function clearCalc(){calcCost.value=0;calcPrice.value=0;calcQtyK.value=0;calcCategory.value='';profitMargin.value=20;priceAuto.value=true}
    function saveCalcDeal(){
    function saveCalcDeal(){if(!customers.value.length){alert('请先添加客户');return}calcSaveIdx.value=-1;calcSaveDate.value=today();calcSaveNote.value='';showCalcSave.value=true}
      calcSaveIdx.value=-1;showCalcSave.value=true
    }
    function onCalcSelectChange(){
      if(calcSaveIdx.value==-2||calcSaveIdx.value=='-2'){
        calcSaveIdx.value=-1;showCalcSave.value=false
        calcSavePending.value=true
        editCustomer.value=null
        Object.assign(custForm,{name:'',contact:'',phone:'',wechat:'',email:'',address:'',tags:[],note:''})
        showAddCustomer.value=true
      }
    }
    function doCalcSave(){
      const idx=Number(calcSaveIdx.value)
      if(idx<0||idx>=customers.value.length){alert('请选择客户');return}
      const customer=customers.value[idx]
      const r=calcCommission(calcCost.value,calcPrice.value,calcQtyK.value*1000)
      deals.value.push({id:uid(),customerId:customer.id,customerName:customer.name,date:calcSaveDate.value,category:calcCategory.value||'其他',costPrice:calcCost.value,sellingPrice:calcPrice.value,quantity:calcQtyK.value*1000,note:calcSaveNote.value||'(来自计算器)',...r})
      showCalcSave.value=false;go('deals')
    }

    // ========== Dashboard ==========
    const totalSales=computed(()=>deals.value.reduce((s,d)=>s+d.salesAmount,0))
    const totalCommission=computed(()=>deals.value.reduce((s,d)=>s+d.totalCommission,0))
    const recentDeals=computed(()=>[...deals.value].reverse().slice(0,5))
    const categories=CATS

    // ========== Return ==========
    return{
      tab,title,go,pgClass,fmt,tagIcon,
      customers,showAddCustomer,showCustDetail,showDelCust,selectedCustomer,editCustomer,custForm,
      openAddCustomer,toggleTag,saveCustomer,openCustomer,editThisCustomer,deleteCustomer,customerDeals,
      customerSearch,dealSearch,filteredCustomers,filteredDeals,deals,showAddDeal,showDealDetail,showDelDeal,selectedDeal,
      editDealId,dealCustomerIdx,dealDate,dealCategory,dealCost,dealPrice,dealQty,dealNote,categories,
      saveDeal,openDeal,deleteDeal,editDeal,closeDealForm,goAddCustomer,
      calcCost,calcPrice,priceAuto,calcQtyK,calcCategory,profitMargin,marginPresets,currentMargin,quickQtysK,actualQty,perPieceProfit,perPieceComm,result,
      showCalcSave,calcSaveIdx,calcSaveDate,calcSaveNote,clearCalc,saveCalcDeal,doCalcSave,onCalcSelectChange,
      totalSales,totalCommission,recentDeals
    }
  }
}).mount('#app')

