import { useState, useEffect, useMemo } from "react";
import { parseDateOnly, dataBR } from "@/lib/date";
import { supabase } from "@/integrations/supabase/client";

interface Employee {
  id: string;
  nome_completo: string;
  cargo: string;
  setor: string | null;
  data_nascimento: string | null;
  foto_url: string | null;
  empresa_id: string | null;
}

interface Birthday extends Employee {
  age: number;
  dayOfMonth: number;
  monthNumber: number;
}

export const useBirthdays = (empresaId?: string, setorId?: string) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployees();
  }, [empresaId, setorId]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("employees")
        .select("id, nome_completo, cargo, setor, data_nascimento, foto_url, empresa_id")
        .in("status", ["ativo", "ferias"])
        .not("data_nascimento", "is", null);

      if (empresaId && empresaId !== "all") {
        query = query.eq("empresa_id", empresaId);
      }

      if (setorId && setorId !== "all") {
        query = query.eq("setor", setorId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error("Error fetching employees:", error);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateAge = (birthDate: string): number => {
    const birth = dataBR(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  };

  const enrichEmployee = (employee: Employee): Birthday => {
    const birthDate = (parseDateOnly(employee.data_nascimento!) ?? new Date());
    return {
      ...employee,
      age: calculateAge(employee.data_nascimento!),
      dayOfMonth: birthDate.getDate(),
      monthNumber: birthDate.getMonth(),
    };
  };

  const birthdaysToday = useMemo(() => {
    const today = new Date();
    const todayDay = today.getDate();
    const todayMonth = today.getMonth();

    return employees
      .filter((emp) => {
        if (!emp.data_nascimento) return false;
        const birthDate = (parseDateOnly(emp.data_nascimento) ?? new Date());
        return birthDate.getDate() === todayDay && birthDate.getMonth() === todayMonth;
      })
      .map(enrichEmployee)
      .sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));
  }, [employees]);

  const birthdaysThisMonth = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth();

    return employees
      .filter((emp) => {
        if (!emp.data_nascimento) return false;
        const birthDate = (parseDateOnly(emp.data_nascimento) ?? new Date());
        return birthDate.getMonth() === currentMonth;
      })
      .map(enrichEmployee)
      .sort((a, b) => a.dayOfMonth - b.dayOfMonth);
  }, [employees]);

  const birthdaysNext7Days = useMemo(() => {
    const today = new Date();
    const next7Days = dataBR(today);
    next7Days.setDate(today.getDate() + 7);

    return employees
      .filter((emp) => {
        if (!emp.data_nascimento) return false;
        const birthDate = (parseDateOnly(emp.data_nascimento) ?? new Date());
        
        // Create birthday for this year
        const birthdayThisYear = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
        
        // If birthday already passed this year, check next year
        if (birthdayThisYear < today) {
          birthdayThisYear.setFullYear(today.getFullYear() + 1);
        }
        
        return birthdayThisYear >= today && birthdayThisYear <= next7Days;
      })
      .map(enrichEmployee)
      .sort((a, b) => {
        const today = new Date();
        const dateA = new Date(today.getFullYear(), a.monthNumber, a.dayOfMonth);
        const dateB = new Date(today.getFullYear(), b.monthNumber, b.dayOfMonth);
        
        if (dateA < today) dateA.setFullYear(today.getFullYear() + 1);
        if (dateB < today) dateB.setFullYear(today.getFullYear() + 1);
        
        return dateA.getTime() - dateB.getTime();
      });
  }, [employees]);

  const employeesWithoutBirthday = useMemo(() => {
    return employees.filter((emp) => !emp.data_nascimento).length;
  }, [employees]);

  return {
    birthdaysToday,
    birthdaysThisMonth,
    birthdaysNext7Days,
    employeesWithoutBirthday,
    loading,
    refetch: fetchEmployees,
  };
};
