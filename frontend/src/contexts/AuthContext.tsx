import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { api } from '../services/api'
import toast from 'react-hot-toast'
import { User, RegisterData } from '../types'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (userData: RegisterData) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  updateProfile: (profileData: Partial<RegisterData>) => Promise<{ success: boolean; error?: string }>
  isAdmin: boolean
  isManager: boolean
  isTeamMember: boolean
}

interface AuthProviderProps {
  children: ReactNode
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      api.setAuthToken(token)
      verifyToken()
    } else {
      setLoading(false)
    }
  }, [])

  const verifyToken = async (): Promise<void> => {
    try {
      const response = await api.auth.verifyToken()
      setUser(response.data.user)
    } catch (error) {
      console.error('Token verification failed:', error)
      localStorage.removeItem('token')
      api.setAuthToken(null)
    } finally {
      setLoading(false)
    }
  }

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await api.auth.login(email, password)
      const { token, user: userData } = response.data

      localStorage.setItem('token', token)
      api.setAuthToken(token)
      setUser(userData)
      
      toast.success(`Welcome back, ${userData.firstName || userData.email}!`)
      return { success: true }
    } catch (error: any) {
      const message = error.response?.data?.error || 'Login failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const register = async (userData: RegisterData): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await api.auth.register(userData)
      const { token, user: newUser } = response.data
      
      localStorage.setItem('token', token)
      api.setAuthToken(token)
      setUser(newUser)
      
      toast.success(`Welcome to TaskFlow, ${newUser.firstName || newUser.email}!`)
      return { success: true }
    } catch (error: any) {
      const message = error.response?.data?.error || 'Registration failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const logout = async (): Promise<void> => {
    try {
      await api.auth.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      localStorage.removeItem('token')
      api.setAuthToken(null)
      setUser(null)
      toast.success('Logged out successfully')
    }
  }

  const updateProfile = async (profileData: Partial<RegisterData>): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await api.auth.updateProfile(profileData)
      setUser(response.data.user)
      toast.success('Profile updated successfully')
      return { success: true }
    } catch (error: any) {
      const message = error.response?.data?.error || 'Profile update failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    logout,
    updateProfile,
    isAdmin: user?.role === 'admin',
    isManager: user?.role === 'project_manager' || user?.role === 'admin',
    isTeamMember: user?.role === 'team_member'
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}