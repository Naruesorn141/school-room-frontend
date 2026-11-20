import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, ConfigProvider, Empty, Form, Input, InputNumber, Modal, Select, Space, Table, Tabs, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ApiError, api, query } from './api';
import type { Classroom, Metadata, Student } from './api';
import './style.css';

const { Title, Text } = Typography;
type StudentFields = Pick<Student,'studentCode'|'prefixId'|'firstName'|'lastName'|'genderId'|'birthDate'|'gradeLevelId'>;
type ClassroomFields = Pick<Classroom,'roomNo'|'roomName'|'academicYear'|'gradeLevelId'|'homeroomTeacherId'>;
const errorText = (error:unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';

export default function App() {
  const [tab,setTab] = useState('students');
  const [metadata,setMetadata] = useState<Metadata>();
  const [students,setStudents] = useState<Student[]>([]);
  const [rosterCandidates,setRosterCandidates] = useState<Student[]>([]);
  const [classrooms,setClassrooms] = useState<Classroom[]>([]);
  const [roster,setRoster] = useState<Student[]>([]);
  const [activeRoom,setActiveRoom] = useState<Classroom|null>(null);
  const [studentEdit,setStudentEdit] = useState<Student|null>(null);
  const [roomEdit,setRoomEdit] = useState<Classroom|null>(null);
  const [studentOpen,setStudentOpen] = useState(false);
  const [roomOpen,setRoomOpen] = useState(false);
  const [addOpen,setAddOpen] = useState(false);
  const [transfer,setTransfer] = useState<{studentId:number;room:{id:number;roomNo:string;roomName:string}}|null>(null);
  const [selectedStudent,setSelectedStudent] = useState<number>();
  const [loading,setLoading] = useState(false);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState('');
  const [studentSearch] = Form.useForm(); const [roomSearch] = Form.useForm();
  const [studentForm] = Form.useForm<StudentFields>(); const [roomForm] = Form.useForm<ClassroomFields>();
  const [msg,contextHolder] = message.useMessage();
  const [modal,modalHolder] = Modal.useModal();
  const fail = (e:unknown) => setError(errorText(e));
  const loadStudents = useCallback(async () => { setLoading(true); try { setStudents(await api<Student[]>(query('/students',studentSearch.getFieldsValue()))); setError(''); } catch(e) { fail(e); } finally { setLoading(false); } },[studentSearch]);
  const loadRooms = useCallback(async () => { setLoading(true); try { setClassrooms(await api<Classroom[]>(query('/classrooms',roomSearch.getFieldsValue()))); setError(''); } catch(e) { fail(e); } finally { setLoading(false); } },[roomSearch]);
  const loadRoster = useCallback(async (roomId:number) => { try { setRoster(await api<Student[]>(`/classrooms/${roomId}/students`)); setError(''); } catch(e) { fail(e); } },[]);
  useEffect(() => { api<Metadata>('/metadata').then(setMetadata).catch(fail); void loadStudents(); },[loadStudents]);
  useEffect(() => { if (tab === 'classrooms') void loadRooms(); },[tab,loadRooms]);
  const openStudent = (student:Student|null) => { setStudentEdit(student); studentForm.resetFields(); studentForm.setFieldsValue(student ?? {studentCode:'',firstName:'',lastName:'',birthDate:''}); setStudentOpen(true); };
  const openRoom = (room:Classroom|null) => { setRoomEdit(room); roomForm.resetFields(); roomForm.setFieldsValue(room ?? {roomNo:'',roomName:'',academicYear:undefined,gradeLevelId:undefined,homeroomTeacherId:null}); setRoomOpen(true); };
  const saveStudent = async (values:StudentFields) => { setSaving(true); try { await api<Student>(studentEdit ? `/students/${studentEdit.id}` : '/students',{method:studentEdit?'PATCH':'POST',body:JSON.stringify(values)}); setStudentOpen(false); msg.success('Student saved'); await loadStudents(); } catch(e) { fail(e); } finally { setSaving(false); } };
  const saveRoom = async (values:ClassroomFields) => { setSaving(true); try { await api<Classroom>(roomEdit ? `/classrooms/${roomEdit.id}` : '/classrooms',{method:roomEdit?'PATCH':'POST',body:JSON.stringify({...values,homeroomTeacherId:values.homeroomTeacherId ?? null})}); setRoomOpen(false); msg.success('Classroom saved'); await loadRooms(); } catch(e) { fail(e); } finally { setSaving(false); } };
  const remove = (kind:'student'|'classroom',id:number) => modal.confirm({title:`Delete ${kind}?`,content:`This will also end its active classroom memberships.`,okText:'Confirm delete',okButtonProps:{danger:true},onOk:async () => { try { await api<void>(`/${kind === 'student'?'students':'classrooms'}/${id}`,{method:'DELETE'}); msg.success(`${kind === 'student'?'Student':'Classroom'} deleted`); await (kind === 'student'?loadStudents():loadRooms()); } catch(e) { fail(e); } }});
  const openRoster = (room:Classroom) => { setActiveRoom(room); void loadRoster(room.id); };
  const removeMember = (student:Student) => { if (!activeRoom) return; modal.confirm({title:`Remove ${student.firstName} ${student.lastName}?`,okText:'Confirm remove',onOk:async () => { try { await api<void>(`/classrooms/${activeRoom.id}/students/${student.id}`,{method:'DELETE'}); msg.success('Student removed'); await loadRoster(activeRoom.id); } catch(e) { fail(e); } }}); };
  const addMember = async (confirmTransfer=false) => { if (!activeRoom || !selectedStudent) return; setSaving(true); try { await api(`/classrooms/${activeRoom.id}/students`,{method:'POST',body:JSON.stringify({studentId:selectedStudent,...(confirmTransfer?{confirmTransfer:true}:{})})}); setTransfer(null); setAddOpen(false); setSelectedStudent(undefined); msg.success(confirmTransfer?'Student transferred':'Student added'); await loadRoster(activeRoom.id); } catch(e) { if (e instanceof ApiError && e.status === 409 && e.body.code === 'STUDENT_IN_OTHER_CLASSROOM' && e.body.currentClassroom && !confirmTransfer) setTransfer({studentId:selectedStudent,room:e.body.currentClassroom}); else fail(e); } finally { setSaving(false); } };
  const studentColumns:ColumnsType<Student> = [
    {title:'Student code',dataIndex:'studentCode'}, {title:'Name',render:(_,s)=>`${s.prefixName} ${s.firstName} ${s.lastName}`}, {title:'Gender',dataIndex:'genderName'}, {title:'Birth date',dataIndex:'birthDate'}, {title:'Grade',dataIndex:'gradeLevelName'},
    {title:'Actions',render:(_,s)=><Space wrap><Button aria-label={`Edit student ${s.studentCode}`} onClick={()=>openStudent(s)}>Edit</Button><Button danger aria-label={`Delete student ${s.studentCode}`} onClick={()=>remove('student',s.id)}>Delete</Button></Space>}
  ];
  const roomColumns:ColumnsType<Classroom> = [
    {title:'Room number',dataIndex:'roomNo'}, {title:'Room name',dataIndex:'roomName'}, {title:'Year',dataIndex:'academicYear'}, {title:'Grade',dataIndex:'gradeLevelName'}, {title:'Homeroom teacher',dataIndex:'homeroomTeacherName',render:v=>v||'—'},
    {title:'Actions',render:(_,r)=><Space wrap><Button aria-label={`View roster ${r.roomNo}`} onClick={()=>openRoster(r)}>Roster</Button><Button aria-label={`Edit classroom ${r.roomNo}`} onClick={()=>openRoom(r)}>Edit</Button><Button danger aria-label={`Delete classroom ${r.roomNo}`} onClick={()=>remove('classroom',r.id)}>Delete</Button></Space>}
  ];
  return <ConfigProvider theme={{token:{colorPrimary:'#145c7a',borderRadius:8}}}>{contextHolder}{modalHolder}<main className="page">
    <header><Title level={1}>School Rooms</Title><Text type="secondary">Students, classrooms, and rosters</Text></header>
    {error && <Alert type="error" showIcon closable message={error} onClose={()=>setError('')} className="error"/>}
    <Tabs activeKey={tab} onChange={setTab} items={[{key:'students',label:'Students',children:<Card title="Students" extra={<Button type="primary" onClick={()=>openStudent(null)}>Add student</Button>}>
      <Form name="student-search" form={studentSearch} layout="inline" onFinish={loadStudents} className="search"><Form.Item name="studentCode" label="Student code search"><Input allowClear/></Form.Item><Form.Item name="name" label="Name search"><Input allowClear/></Form.Item><Form.Item name="gradeLevelId" label="Grade search"><Select allowClear placeholder="All grades" style={{minWidth:140}} options={metadata?.gradeLevels.map(g=>({value:g.id,label:g.name}))}/></Form.Item><Button htmlType="submit">Search students</Button></Form>
      <Table rowKey="id" loading={loading} dataSource={students} columns={studentColumns} pagination={{pageSize:10}} locale={{emptyText:<Empty description="No students found"/>}} scroll={{x:850}}/>
    </Card>},{key:'classrooms',label:'Classrooms',children:<Card title="Classrooms" extra={<Button type="primary" onClick={()=>openRoom(null)}>Add classroom</Button>}>
      <Form name="room-search" form={roomSearch} layout="inline" onFinish={loadRooms} className="search"><Form.Item name="roomNo" label="Room number search"><Input allowClear/></Form.Item><Form.Item name="roomName" label="Room name search"><Input allowClear/></Form.Item><Form.Item name="teacherName" label="Teacher search"><Input allowClear/></Form.Item><Button htmlType="submit">Search classrooms</Button></Form>
      <Table rowKey="id" loading={loading} dataSource={classrooms} columns={roomColumns} pagination={{pageSize:10}} locale={{emptyText:<Empty description="No classrooms found"/>}} scroll={{x:900}}/>
    </Card>}]} />
    <Modal title={studentEdit?'Edit student':'Add student'} open={studentOpen} onCancel={()=>setStudentOpen(false)} footer={null} destroyOnHidden><Form name="student-editor" form={studentForm} layout="vertical" onFinish={saveStudent}>
      <Form.Item name="studentCode" label="Student code" rules={[{required:true}]}><Input maxLength={20}/></Form.Item>
      <Form.Item name="prefixId" label="Prefix" rules={[{required:true}]}><Select options={metadata?.prefixes.map(x=>({value:x.id,label:x.name}))}/></Form.Item>
      <Form.Item name="firstName" label="First name" rules={[{required:true}]}><Input maxLength={100}/></Form.Item>
      <Form.Item name="lastName" label="Last name" rules={[{required:true}]}><Input maxLength={100}/></Form.Item>
      <Form.Item name="genderId" label="Gender" rules={[{required:true}]}><Select options={metadata?.genders.map(x=>({value:x.id,label:x.name}))}/></Form.Item>
      <Form.Item name="birthDate" label="Birth date" rules={[{required:true}]}><Input type="date"/></Form.Item>
      <Form.Item name="gradeLevelId" label="Grade level" rules={[{required:true}]}><Select options={metadata?.gradeLevels.map(x=>({value:x.id,label:x.name}))}/></Form.Item>
      <Button type="primary" htmlType="submit" loading={saving}>Save student</Button>
    </Form></Modal>
    <Modal title={roomEdit?'Edit classroom':'Add classroom'} open={roomOpen} onCancel={()=>setRoomOpen(false)} footer={null} destroyOnHidden><Form name="room-editor" form={roomForm} layout="vertical" onFinish={saveRoom}>
      <Form.Item name="roomNo" label="Room number" rules={[{required:true}]}><Input maxLength={20}/></Form.Item>
      <Form.Item name="roomName" label="Room name" rules={[{required:true}]}><Input maxLength={100}/></Form.Item>
      <Form.Item name="academicYear" label="Academic year" rules={[{required:true}]}><InputNumber min={1} max={65535} style={{width:'100%'}}/></Form.Item>
      <Form.Item name="gradeLevelId" label="Grade level" rules={[{required:true}]}><Select options={metadata?.gradeLevels.map(x=>({value:x.id,label:x.name}))}/></Form.Item>
      <Form.Item name="homeroomTeacherId" label="Homeroom teacher"><Select allowClear placeholder="None" options={metadata?.teachers.map(x=>({value:x.id,label:`${x.prefixName} ${x.firstName} ${x.lastName}`}))}/></Form.Item>
      <Button type="primary" htmlType="submit" loading={saving}>Save classroom</Button>
    </Form></Modal>
    <Modal title={activeRoom?`Roster — ${activeRoom.roomNo} ${activeRoom.roomName}`:'Roster'} open={!!activeRoom} onCancel={()=>setActiveRoom(null)} footer={<Button aria-label="Close roster" onClick={()=>setActiveRoom(null)}>Close roster</Button>} width={720}>
      <Button type="primary" onClick={()=>{setSelectedStudent(undefined);setAddOpen(true);api<Student[]>('/students?').then(setRosterCandidates).catch(fail);}}>Add to roster</Button>
      <Table rowKey="id" dataSource={roster} pagination={false} locale={{emptyText:<Empty description="No students in this classroom"/>}} columns={[{title:'Student code',dataIndex:'studentCode'},{title:'Name',render:(_,s:Student)=>`${s.firstName} ${s.lastName}`},{title:'Grade',dataIndex:'gradeLevelName'},{title:'',render:(_,s:Student)=><Button danger aria-label={`Remove student ${s.studentCode}`} onClick={()=>removeMember(s)}>Remove</Button>}]} scroll={{x:550}}/>
    </Modal>
    <Modal title="Add student to roster" open={addOpen} onCancel={()=>{setAddOpen(false);setTransfer(null)}} footer={<><Button onClick={()=>setAddOpen(false)}>Cancel</Button><Button type="primary" disabled={!selectedStudent} loading={saving} onClick={()=>void addMember()}>Add selected student</Button></>}>
      <label htmlFor="roster-student">Student</label><Select id="roster-student" aria-label="Student" showSearch optionFilterProp="label" value={selectedStudent} onChange={setSelectedStudent} placeholder="Select student" style={{width:'100%'}} options={rosterCandidates.filter(s=>s.gradeLevelId===activeRoom?.gradeLevelId && !roster.some(r=>r.id===s.id)).map(s=>({value:s.id,label:`${s.studentCode} — ${s.firstName} ${s.lastName}`}))}/>
    </Modal>
    <Modal title="Transfer student?" open={!!transfer} onCancel={()=>setTransfer(null)} footer={<><Button onClick={()=>setTransfer(null)}>Cancel transfer</Button><Button type="primary" loading={saving} onClick={()=>void addMember(true)}>Confirm transfer</Button></>}>
      <p>This student is currently in classroom {transfer?.room.roomNo} — {transfer?.room.roomName}. Transfer to {activeRoom?.roomNo} {activeRoom?.roomName}?</p>
    </Modal>
  </main></ConfigProvider>;
}
