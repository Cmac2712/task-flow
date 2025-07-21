import { useForm } from "react-hook-form";
import { api } from "../services/api";

export const RegisterPage = () => {
    const { register, handleSubmit, formState: { errors } } = useForm();


    return (
        <form onSubmit={handleSubmit(api.auth.register)}>
            <h1>Register</h1>
            <input type="text" {...register("firstName")} placeholder="First Name" />
            <input type="text" {...register("lastName")} placeholder="Last Name" />
            <input type="email" {...register("email")} placeholder="Email" />
            <input type="password" {...register("password")} placeholder="Password" />
            <button type="submit">Register</button>
            <p>{errors.email?.message}</p>
        </form>
    )
}