import { notFound } from "next/navigation";import { StudentForm } from "@/components/student-management";
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string}>}){const[{id},q]=await Promise.all([params,searchParams]);if(!/^[0-9a-f-]{36}$/i.test(id))notFound();return <StudentForm id={id} params={q}/>}
