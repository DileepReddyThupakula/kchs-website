import { StudentForm } from "@/components/student-management";
export default async function Page({searchParams}:{searchParams:Promise<{error?:string}>}){return <StudentForm params={await searchParams}/>}
