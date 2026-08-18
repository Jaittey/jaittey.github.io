
window.addEventListener('DOMContentLoaded',async()=>{
 const employees=await SBDB.list('employees'),date=document.querySelector('#attendanceDate'),list=document.querySelector('#attendanceList');date.value=new Date().toISOString().slice(0,10);
 function render(){list.innerHTML=employees.map(e=>`<div class="card"><h3>${SBUI.escape(e.name||e.fullName||'Employee')}</h3><div class="form-grid"><label><span>Shift</span><select data-shift="${e.id}"><option>Morning</option><option>Evening</option><option>Night</option><option>Off</option></select></label><label><span>Hours</span><input type="number" step=".25" value="8" data-hours="${e.id}"></label></div></div>`).join('')||'<div class="empty">Add employees first.</div>'}
 document.querySelector('#saveAttendance').onclick=async()=>{for(const e of employees){await SBDB.save('attendance',{employeeId:e.id,employeeName:e.name||e.fullName,date:date.value,attendanceMonth:date.value.slice(0,7),shift:document.querySelector(`[data-shift="${e.id}"]`).value,hours:Number(document.querySelector(`[data-hours="${e.id}"]`).value||0)},`${e.id}_${date.value}`)}SBUI.toast('Attendance saved')};render()
});
