import { notFound } from "next/navigation";import { EnrollmentEditor } from "@/components/student-management";
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string}>}){const[{id},q]=await Promise.all([params,searchParams]);if(!/^[0-9a-f-]{36}$/i.test(id))notFound();return <EnrollmentEditor id={id} params={q}/>}
