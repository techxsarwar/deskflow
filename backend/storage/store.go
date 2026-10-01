package storage

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	_ "github.com/lib/pq"
	"study-lounge-backend/models"
)

type Store struct {
	mu           sync.RWMutex
	filePath     string
	db           *sql.DB
	students     []models.Student
	transactions []models.FeeTransaction
	seats        []models.LoungeSeat
}

type fileData struct {
	Students     []models.Student        `json:"students"`
	Transactions []models.FeeTransaction `json:"transactions"`
	Seats        []models.LoungeSeat     `json:"seats"`
}

func NewStore(dataDir string, dbURL string) (*Store, error) {
	s := &Store{}

	// If DATABASE_URL is provided, connect to Supabase PostgreSQL
	if dbURL != "" && !strings.Contains(dbURL, "[YOUR-PASSWORD]") {
		if !strings.Contains(dbURL, "sslmode=") {
			if strings.Contains(dbURL, "?") {
				dbURL += "&sslmode=require"
			} else {
				dbURL += "?sslmode=require"
			}
		}

		db, err := sql.Open("postgres", dbURL)
		if err == nil {
			db.SetMaxOpenConns(10)
			db.SetMaxIdleConns(5)
			db.SetConnMaxLifetime(5 * time.Minute)

			if pingErr := db.Ping(); pingErr == nil {
				s.db = db
				log.Println("✅ Golang backend connected directly to Supabase PostgreSQL!")
				return s, nil
			} else {
				log.Printf("⚠️ PostgreSQL ping failed: %v. Falling back to local storage.", pingErr)
			}
		} else {
			log.Printf("⚠️ PostgreSQL connection failed: %v. Falling back to local storage.", err)
		}
	}

	// Local file fallback
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create data directory: %w", err)
	}

	filePath := filepath.Join(dataDir, "study_lounge_data.json")
	s.filePath = filePath

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		s.seedInitialData()
		if err := s.saveToFile(); err != nil {
			return nil, fmt.Errorf("failed to save initial seed: %w", err)
		}
	} else {
		if err := s.loadFromFile(); err != nil {
			return nil, fmt.Errorf("failed to load data from file: %w", err)
		}
	}

	log.Println("📁 Golang backend operating in local JSON file mode.")
	return s, nil
}

func (s *Store) loadFromFile() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	bytes, err := os.ReadFile(s.filePath)
	if err != nil {
		return err
	}

	var data fileData
	if err := json.Unmarshal(bytes, &data); err != nil {
		return err
	}

	s.students = data.Students
	s.transactions = data.Transactions
	s.seats = data.Seats
	return nil
}

func (s *Store) saveToFile() error {
	data := fileData{
		Students:     s.students,
		Transactions: s.transactions,
		Seats:        s.seats,
	}

	bytes, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(s.filePath, bytes, 0644)
}

func (s *Store) seedInitialData() {
	s.students = []models.Student{}
	s.transactions = []models.FeeTransaction{}

	// 30 Clean Desks ready for student registration (20 Dedicated, 10 Flexible - No Cabins)
	s.seats = make([]models.LoungeSeat, 30)
	for i := 0; i < 30; i++ {
		num := i + 1
		if num <= 20 {
			seatNo := fmt.Sprintf("D-%02d", num)
			s.seats[i] = models.LoungeSeat{
				ID:         "SEAT-" + seatNo,
				SeatNumber: seatNo,
				Type:       "dedicated",
				Section:    "Main Silent Hall A",
				Status:     "available",
			}
		} else {
			seatNo := fmt.Sprintf("F-%02d", num-20)
			s.seats[i] = models.LoungeSeat{
				ID:         "SEAT-" + seatNo,
				SeatNumber: seatNo,
				Type:       "flexible",
				Section:    "Flexi Open Zone B",
				Status:     "available",
			}
		}
	}
}

// -----------------------------------------------------------------------------
// Student Methods
// -----------------------------------------------------------------------------
func (s *Store) GetAllStudents() []models.Student {
	if s.db != nil {
		query := `SELECT 
			id, reg_no, full_name, COALESCE(email, ''), phone, COALESCE(emergency_contact, ''), 
			COALESCE(address, ''), COALESCE(study_goal, ''), shift, seat_type, 
			COALESCE(seat_number, 'Unassigned'), COALESCE(locker_number, ''), 
			membership_plan, plan_amount, amount_paid, amount_due, payment_status, 
			start_date::text, end_date::text, status, registered_via, 
			created_at::text, COALESCE(notes, '') 
		FROM public.students ORDER BY created_at DESC`

		rows, err := s.db.Query(query)
		if err != nil {
			log.Printf("Error querying students: %v", err)
			return []models.Student{}
		}
		defer rows.Close()

		var res []models.Student
		for rows.Next() {
			var st models.Student
			if err := rows.Scan(
				&st.ID, &st.RegNo, &st.FullName, &st.Email, &st.Phone, &st.EmergencyContact,
				&st.Address, &st.StudyGoal, &st.Shift, &st.SeatType, &st.SeatNumber,
				&st.LockerNumber, &st.MembershipPlan, &st.PlanAmount, &st.AmountPaid,
				&st.AmountDue, &st.PaymentStatus, &st.StartDate, &st.EndDate, &st.Status,
				&st.RegisteredVia, &st.CreatedAt, &st.Notes,
			); err != nil {
				log.Printf("Error scanning student: %v", err)
				continue
			}
			res = append(res, st)
		}
		return res
	}

	s.mu.RLock()
	defer s.mu.RUnlock()
	res := make([]models.Student, len(s.students))
	copy(res, s.students)
	return res
}

func (s *Store) GetStudentByID(id string) (*models.Student, bool) {
	if s.db != nil {
		query := `SELECT 
			id, reg_no, full_name, COALESCE(email, ''), phone, COALESCE(emergency_contact, ''), 
			COALESCE(address, ''), COALESCE(study_goal, ''), shift, seat_type, 
			COALESCE(seat_number, 'Unassigned'), COALESCE(locker_number, ''), 
			membership_plan, plan_amount, amount_paid, amount_due, payment_status, 
			start_date::text, end_date::text, status, registered_via, 
			created_at::text, COALESCE(notes, '') 
		FROM public.students WHERE id = $1`

		var st models.Student
		err := s.db.QueryRow(query, id).Scan(
			&st.ID, &st.RegNo, &st.FullName, &st.Email, &st.Phone, &st.EmergencyContact,
			&st.Address, &st.StudyGoal, &st.Shift, &st.SeatType, &st.SeatNumber,
			&st.LockerNumber, &st.MembershipPlan, &st.PlanAmount, &st.AmountPaid,
			&st.AmountDue, &st.PaymentStatus, &st.StartDate, &st.EndDate, &st.Status,
			&st.RegisteredVia, &st.CreatedAt, &st.Notes,
		)
		if err != nil {
			return nil, false
		}
		return &st, true
	}

	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, student := range s.students {
		if student.ID == id {
			return &student, true
		}
	}
	return nil, false
}

func (s *Store) AddStudent(student models.Student) (models.Student, error) {
	count := len(s.GetAllStudents()) + 1
	if student.ID == "" {
		student.ID = fmt.Sprintf("STU-%03d-%d", count, time.Now().Unix()%10000)
	}
	if student.RegNo == "" {
		student.RegNo = fmt.Sprintf("SL-%d-%03d", time.Now().Year(), 100+count)
	}
	if student.CreatedAt == "" {
		student.CreatedAt = time.Now().Format(time.RFC3339)
	}

	due := student.PlanAmount - student.AmountPaid
	if due < 0 {
		due = 0
	}
	student.AmountDue = due

	if student.AmountPaid >= student.PlanAmount {
		student.PaymentStatus = "paid"
	} else if student.AmountPaid > 0 {
		student.PaymentStatus = "partial"
	} else {
		student.PaymentStatus = "pending"
	}

	if student.RegisteredVia == "online_link" {
		student.Status = "pending"
		if student.SeatNumber == "" {
			student.SeatNumber = "Unassigned"
		}
	} else {
		if student.Status == "" {
			student.Status = "active"
		}
	}

	if s.db != nil {
		insertQuery := `INSERT INTO public.students (
			id, reg_no, full_name, email, phone, emergency_contact, address, study_goal,
			shift, seat_type, seat_number, locker_number, membership_plan, plan_amount,
			amount_paid, amount_due, payment_status, start_date, end_date, status,
			registered_via, notes
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`

		_, err := s.db.Exec(
			insertQuery,
			student.ID, student.RegNo, student.FullName, student.Email, student.Phone,
			student.EmergencyContact, student.Address, student.StudyGoal, student.Shift,
			student.SeatType, student.SeatNumber, student.LockerNumber, student.MembershipPlan,
			student.PlanAmount, student.AmountPaid, student.AmountDue, student.PaymentStatus,
			student.StartDate, student.EndDate, student.Status, student.RegisteredVia, student.Notes,
		)
		if err != nil {
			return student, fmt.Errorf("failed to insert student into DB: %w", err)
		}

		if student.AmountPaid > 0 {
			receipt := fmt.Sprintf("RCP-%d", time.Now().UnixNano()%1000000)
			txnID := fmt.Sprintf("TXN-%d", time.Now().UnixNano()%1000000)
			_, _ = s.db.Exec(`INSERT INTO public.fee_transactions (
				id, student_id, student_name, reg_no, amount, payment_date, payment_mode, receipt_number, remarks
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
				txnID, student.ID, student.FullName, student.RegNo, student.AmountPaid,
				time.Now().Format("2006-01-02"), "upi", receipt, "Initial Registration Fee",
			)
		}

		if student.SeatNumber != "" && student.SeatNumber != "Unassigned" {
			_, _ = s.db.Exec(`UPDATE public.seats SET status = 'occupied', current_student_id = $1, current_student_name = $2, shift = $3 WHERE seat_number = $4`,
				student.ID, student.FullName, student.Shift, student.SeatNumber,
			)
		}

		return student, nil
	}

	// Local memory/file execution
	s.mu.Lock()
	defer s.mu.Unlock()

	if student.SeatNumber != "" && student.SeatNumber != "Unassigned" {
		for i := range s.seats {
			if s.seats[i].SeatNumber == student.SeatNumber {
				s.seats[i].Status = "occupied"
				s.seats[i].CurrentStudentID = student.ID
				s.seats[i].CurrentStudentName = student.FullName
				s.seats[i].Shift = student.Shift
				break
			}
		}
	}

	if student.AmountPaid > 0 {
		txn := models.FeeTransaction{
			ID:            fmt.Sprintf("TXN-%d", time.Now().UnixNano()%1000000),
			StudentID:     student.ID,
			StudentName:   student.FullName,
			RegNo:         student.RegNo,
			Amount:        student.AmountPaid,
			PaymentDate:   time.Now().Format("2006-01-02"),
			PaymentMode:   "upi",
			ReceiptNumber: fmt.Sprintf("RCP-%d", time.Now().UnixNano()%1000000),
			Remarks:       "Initial Registration Fee",
		}
		s.transactions = append([]models.FeeTransaction{txn}, s.transactions...)
	}

	s.students = append([]models.Student{student}, s.students...)
	_ = s.saveToFile()
	return student, nil
}

func (s *Store) UpdateStudent(id string, update models.Student) (*models.Student, error) {
	due := update.PlanAmount - update.AmountPaid
	if due < 0 {
		due = 0
	}
	update.AmountDue = due
	if update.AmountPaid >= update.PlanAmount {
		update.PaymentStatus = "paid"
	} else if update.AmountPaid > 0 {
		update.PaymentStatus = "partial"
	} else {
		update.PaymentStatus = "pending"
	}

	if s.db != nil {
		query := `UPDATE public.students SET 
			full_name = $1, email = $2, phone = $3, emergency_contact = $4, address = $5,
			study_goal = $6, shift = $7, seat_type = $8, seat_number = $9, locker_number = $10,
			membership_plan = $11, plan_amount = $12, amount_paid = $13, amount_due = $14,
			payment_status = $15, start_date = $16, end_date = $17, status = $18, notes = $19
		WHERE id = $20`

		_, err := s.db.Exec(query,
			update.FullName, update.Email, update.Phone, update.EmergencyContact, update.Address,
			update.StudyGoal, update.Shift, update.SeatType, update.SeatNumber, update.LockerNumber,
			update.MembershipPlan, update.PlanAmount, update.AmountPaid, update.AmountDue,
			update.PaymentStatus, update.StartDate, update.EndDate, update.Status, update.Notes, id,
		)
		if err != nil {
			return nil, err
		}
		update.ID = id
		return &update, nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	for i, st := range s.students {
		if st.ID == id {
			update.ID = id
			update.RegNo = st.RegNo
			s.students[i] = update
			_ = s.saveToFile()
			return &update, nil
		}
	}
	return nil, fmt.Errorf("student not found")
}

func (s *Store) DeleteStudent(id string) bool {
	if s.db != nil {
		_, _ = s.db.Exec(`UPDATE public.seats SET status = 'available', current_student_id = NULL, current_student_name = NULL, shift = NULL WHERE current_student_id = $1`, id)
		res, err := s.db.Exec(`DELETE FROM public.students WHERE id = $1`, id)
		if err != nil {
			return false
		}
		rows, _ := res.RowsAffected()
		return rows > 0
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	found := false
	var updated []models.Student
	for _, st := range s.students {
		if st.ID == id {
			found = true
			for i := range s.seats {
				if s.seats[i].CurrentStudentID == id {
					s.seats[i].Status = "available"
					s.seats[i].CurrentStudentID = ""
					s.seats[i].CurrentStudentName = ""
					s.seats[i].Shift = ""
				}
			}
		} else {
			updated = append(updated, st)
		}
	}

	if found {
		s.students = updated
		_ = s.saveToFile()
	}
	return found
}

func (s *Store) ApproveStudent(id string, seatNumber string) (*models.Student, error) {
	st, exists := s.GetStudentByID(id)
	if !exists {
		return nil, fmt.Errorf("student not found")
	}

	assigned := seatNumber
	if assigned == "" {
		if st.SeatNumber != "" && st.SeatNumber != "Unassigned" {
			assigned = st.SeatNumber
		} else {
			assigned = "D-02"
		}
	}

	if s.db != nil {
		_, err := s.db.Exec(`UPDATE public.students SET status = 'active', seat_number = $1 WHERE id = $2`, assigned, id)
		if err != nil {
			return nil, err
		}
		_, _ = s.db.Exec(`UPDATE public.seats SET status = 'occupied', current_student_id = $1, current_student_name = $2, shift = $3 WHERE seat_number = $4`,
			st.ID, st.FullName, st.Shift, assigned,
		)
		st.Status = "active"
		st.SeatNumber = assigned
		return st, nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	for i, student := range s.students {
		if student.ID == id {
			s.students[i].Status = "active"
			s.students[i].SeatNumber = assigned

			for j := range s.seats {
				if s.seats[j].SeatNumber == assigned {
					s.seats[j].Status = "occupied"
					s.seats[j].CurrentStudentID = student.ID
					s.seats[j].CurrentStudentName = student.FullName
					s.seats[j].Shift = student.Shift
				}
			}

			_ = s.saveToFile()
			return &s.students[i], nil
		}
	}
	return nil, fmt.Errorf("student not found")
}

// -----------------------------------------------------------------------------
// Fees & Transactions
// -----------------------------------------------------------------------------
func (s *Store) GetAllTransactions() []models.FeeTransaction {
	if s.db != nil {
		query := `SELECT 
			id, student_id, student_name, reg_no, amount, 
			payment_date::text, payment_mode, receipt_number, COALESCE(remarks, '') 
		FROM public.fee_transactions ORDER BY created_at DESC`

		rows, err := s.db.Query(query)
		if err != nil {
			log.Printf("Error querying transactions: %v", err)
			return []models.FeeTransaction{}
		}
		defer rows.Close()

		var res []models.FeeTransaction
		for rows.Next() {
			var t models.FeeTransaction
			if err := rows.Scan(
				&t.ID, &t.StudentID, &t.StudentName, &t.RegNo, &t.Amount,
				&t.PaymentDate, &t.PaymentMode, &t.ReceiptNumber, &t.Remarks,
			); err != nil {
				continue
			}
			res = append(res, t)
		}
		return res
	}

	s.mu.RLock()
	defer s.mu.RUnlock()
	res := make([]models.FeeTransaction, len(s.transactions))
	copy(res, s.transactions)
	return res
}

func (s *Store) CollectFee(req models.CollectFeeRequest) (*models.FeeTransaction, error) {
	st, exists := s.GetStudentByID(req.StudentID)
	if !exists {
		return nil, fmt.Errorf("student not found")
	}

	receiptNumber := fmt.Sprintf("RCP-%d", time.Now().UnixNano()%1000000)
	txnID := fmt.Sprintf("TXN-%d", time.Now().UnixNano()%1000000)
	paymentDate := time.Now().Format("2006-01-02")

	txn := models.FeeTransaction{
		ID:            txnID,
		StudentID:     st.ID,
		StudentName:   st.FullName,
		RegNo:         st.RegNo,
		Amount:        req.Amount,
		PaymentDate:   paymentDate,
		PaymentMode:   req.PaymentMode,
		ReceiptNumber: receiptNumber,
		Remarks:       req.Remarks,
	}

	newPaid := st.AmountPaid + req.Amount
	newDue := st.PlanAmount - newPaid
	if newDue < 0 {
		newDue = 0
	}
	newPaymentStatus := "pending"
	if newPaid >= st.PlanAmount {
		newPaymentStatus = "paid"
	} else if newPaid > 0 {
		newPaymentStatus = "partial"
	}

	if s.db != nil {
		_, err := s.db.Exec(`INSERT INTO public.fee_transactions (
			id, student_id, student_name, reg_no, amount, payment_date, payment_mode, receipt_number, remarks
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
			txn.ID, txn.StudentID, txn.StudentName, txn.RegNo, txn.Amount,
			txn.PaymentDate, txn.PaymentMode, txn.ReceiptNumber, txn.Remarks,
		)
		if err != nil {
			return nil, err
		}

		_, _ = s.db.Exec(`UPDATE public.students SET amount_paid = $1, amount_due = $2, payment_status = $3 WHERE id = $4`,
			newPaid, newDue, newPaymentStatus, st.ID,
		)
		return &txn, nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	for i := range s.students {
		if s.students[i].ID == req.StudentID {
			s.students[i].AmountPaid = newPaid
			s.students[i].AmountDue = newDue
			s.students[i].PaymentStatus = newPaymentStatus
			break
		}
	}

	s.transactions = append([]models.FeeTransaction{txn}, s.transactions...)
	_ = s.saveToFile()
	return &txn, nil
}

// -----------------------------------------------------------------------------
// Seats
// -----------------------------------------------------------------------------
func (s *Store) GetAllSeats() []models.LoungeSeat {
	if s.db != nil {
		query := `SELECT 
			id, seat_number, type, section, status, 
			COALESCE(current_student_id, ''), COALESCE(current_student_name, ''), COALESCE(shift, '') 
		FROM public.seats ORDER BY seat_number`

		rows, err := s.db.Query(query)
		if err != nil {
			log.Printf("Error querying seats: %v", err)
			return []models.LoungeSeat{}
		}
		defer rows.Close()

		var res []models.LoungeSeat
		for rows.Next() {
			var seat models.LoungeSeat
			if err := rows.Scan(
				&seat.ID, &seat.SeatNumber, &seat.Type, &seat.Section, &seat.Status,
				&seat.CurrentStudentID, &seat.CurrentStudentName, &seat.Shift,
			); err != nil {
				continue
			}
			res = append(res, seat)
		}
		return res
	}

	s.mu.RLock()
	defer s.mu.RUnlock()
	res := make([]models.LoungeSeat, len(s.seats))
	copy(res, s.seats)
	return res
}

func (s *Store) AssignSeat(studentID string, seatNumber string) error {
	st, exists := s.GetStudentByID(studentID)
	if !exists {
		return fmt.Errorf("student not found")
	}

	if s.db != nil {
		oldSeat := st.SeatNumber
		if oldSeat != "" && oldSeat != "Unassigned" {
			_, _ = s.db.Exec(`UPDATE public.seats SET status = 'available', current_student_id = NULL, current_student_name = NULL, shift = NULL WHERE seat_number = $1`, oldSeat)
		}
		_, err := s.db.Exec(`UPDATE public.seats SET status = 'occupied', current_student_id = $1, current_student_name = $2, shift = $3 WHERE seat_number = $4`,
			st.ID, st.FullName, st.Shift, seatNumber,
		)
		if err != nil {
			return err
		}
		_, _ = s.db.Exec(`UPDATE public.students SET seat_number = $1 WHERE id = $2`, seatNumber, studentID)
		return nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	oldSeat := st.SeatNumber
	for i := range s.seats {
		if s.seats[i].SeatNumber == oldSeat {
			s.seats[i].Status = "available"
			s.seats[i].CurrentStudentID = ""
			s.seats[i].CurrentStudentName = ""
			s.seats[i].Shift = ""
		}
		if s.seats[i].SeatNumber == seatNumber {
			s.seats[i].Status = "occupied"
			s.seats[i].CurrentStudentID = st.ID
			s.seats[i].CurrentStudentName = st.FullName
			s.seats[i].Shift = st.Shift
		}
	}

	for i := range s.students {
		if s.students[i].ID == studentID {
			s.students[i].SeatNumber = seatNumber
			break
		}
	}

	_ = s.saveToFile()
	return nil
}

// -----------------------------------------------------------------------------
// Dashboard Stats
// -----------------------------------------------------------------------------
func (s *Store) GetDashboardStats() models.DashboardStats {
	students := s.GetAllStudents()
	seats := s.GetAllSeats()
	txns := s.GetAllTransactions()

	active := 0
	pending := 0
	dues := 0
	shifts := make(map[string]int)

	for _, st := range students {
		if st.Status == "active" {
			active++
			shifts[st.Shift]++
		} else if st.Status == "pending" {
			pending++
		}
		dues += st.AmountDue
	}

	revenue := 0
	for _, t := range txns {
		revenue += t.Amount
	}

	totalSeats := len(seats)
	occupied := 0
	for _, seat := range seats {
		if seat.Status == "occupied" {
			occupied++
		}
	}
	available := totalSeats - occupied
	occPercent := 0
	if totalSeats > 0 {
		occPercent = (occupied * 100) / totalSeats
	}

	return models.DashboardStats{
		TotalStudents:       len(students),
		ActiveStudents:      active,
		PendingStudents:     pending,
		TotalSeats:          totalSeats,
		OccupiedSeats:       occupied,
		AvailableSeats:      available,
		OccupancyPercentage: occPercent,
		TotalRevenue:        revenue,
		PendingDues:         dues,
		ShiftDistribution:   shifts,
	}
}
