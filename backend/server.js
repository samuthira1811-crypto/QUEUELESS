const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const app = express();
async function sendQueueLessEmail({ to, subject, text }) {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "Content-Type": "application/json",
      "accept": "application/json"
    },
    body: JSON.stringify({
      sender: {
        name: "Queue Less",
        email: process.env.EMAIL_USER
      },
      to: [{ email: to }],
      subject,
      textContent: text
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || JSON.stringify(data));
  }

  return data;
}

app.use(cors());
app.use(express.json());

const bookingSchema = new mongoose.Schema(
  {
    token: { type: Number, required: true },
    name: { type: String, required: true },
    age: { type: Number, required: true },
    gender: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    reason: { type: String, required: true },
    specialist: { type: String, required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    visitType: { type: String, required: true },
    status: { type: String, default: "Waiting" }
  },
  { timestamps: true }
);

const Booking = mongoose.model("Booking", bookingSchema);
function verifyAdmin(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      message: "Admin login required"
    });
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired admin token"
    });
  }
}

app.get("/", (req, res) => {
  res.json({ message: "Queue Less backend is running!" });
});

app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;

  if (!process.env.ADMIN_PASSWORD || !process.env.JWT_SECRET) {
    return res.status(500).json({
      message: "Admin authentication is not configured"
    });
  }

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({
      message: "Incorrect admin password"
    });
  }

  const token = jwt.sign(
    { role: "admin" },
    process.env.JWT_SECRET,
    { expiresIn: "2h" }
  );

  res.json({
    message: "Admin login successful",
    token
  });
});

app.post("/api/bookings", async (req, res) => {
  try {
    const {
      name, age, gender, phone, email, reason,
      specialist, date, time, visitType
    } = req.body;

    if (
      !name || !age || !gender || !phone ||!email ||
      !reason || !specialist || !date ||
      !time || !visitType
    ) {
      return res.status(400).json({
        message: "Please fill in all fields."
      });
    }

    const lastBooking = await Booking.findOne().sort({ token: -1 });
    const nextToken = lastBooking ? lastBooking.token + 1 : 1;

    const booking = await Booking.create({
      token: nextToken,
      name, age, gender, phone, email, reason,
      specialist, date, time, visitType
    });

   // Send booking confirmation email
let emailSent = false;

try {
  await sendQueueLessEmail({
  to: booking.email,
  subject: "Appointment Confirmed | Queue Less",
  text: `
Hello ${booking.name},

Your clinic appointment has been booked successfully!

Token Number: ${booking.token}
Specialist: ${booking.specialist}
Appointment Date: ${booking.date}
Appointment Time: ${booking.time}
Status: ${booking.status}

Thank you for choosing Queue Less!
  `
});

  emailSent = true;
  console.log("Booking confirmation email sent to:", booking.email);

} catch (emailError) {
  console.error("Email sending failed:", emailError.message);
}

    res.status(201).json({
  message: "Booking created successfully!",
  booking,
  emailSent
});
  } catch (error) {
    console.error("Booking error:", error.message);
    res.status(500).json({
      message: "Unable to save booking."
    });
  }
});

app.get("/api/bookings",verifyAdmin, async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    console.error("Fetch error:", error.message);
    res.status(500).json({
      message: "Unable to fetch bookings."
    });
  }
});

app.get("/api/bookings/:token/waiting", async (req, res) => {
  try {
    const token = Number(req.params.token);

    const currentBooking = await Booking.findOne({ token });

    if (!currentBooking) {
      return res.status(404).json({
        message: "Booking not found"
      });
    }

    const patientsAhead = await Booking.countDocuments({
      token: { $lt: token },
      status: "Waiting",
      date: currentBooking.date,
      specialist: currentBooking.specialist
    });

    const averageMinutes = 8;
    const estimatedMinutes = patientsAhead * averageMinutes;

        res.json({
        token: currentBooking.token,
        patientsAhead,
        estimatedMinutes
        });
    } catch (error) {
        console.error("Waiting time error:", error.message);
        res.status(500).json({
        message: "Unable to calculate waiting time"
        });
    }
    });

    app.get("/api/bookings/:token/status", async (req, res) => {
  try {
    const token = Number(req.params.token);

    const booking = await Booking.findOne({ token }).select("token status");

    if (!booking) {
      return res.status(404).json({
        message: "Booking not found"
      });
    }

    res.json({
      token: booking.token,
      status: booking.status
    });

  } catch (error) {
    res.status(500).json({
      message: "Unable to fetch booking status"
    });
  }
});
    

app.patch("/api/bookings/:id/status",verifyAdmin, async (req, res) => {
  try {
    console.log("PATCH API CALLED");
    const { status } = req.body;

    const allowedStatuses = [
      "Waiting",
      "Consulting",
      "Completed"
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid booking status"
      });
    }

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!booking) {
      return res.status(404).json({
        message: "Booking not found"
      });
    }

    // Send status update email
    console.log("STATUS EMAIL CODE REACHED");
    let emailSent = false;

    try {
      await sendQueueLessEmail({
  to: booking.email,
  subject: "Queue Less - Appointment Status Updated",
  text: `
Hello ${booking.name},

Your appointment status has been updated!

Token Number: ${booking.token}
Specialist: ${booking.specialist}
Appointment Date: ${booking.date}
Appointment Time: ${booking.time}
Current Status: ${booking.status}

Thank you for choosing Queue Less!
  `
});

      emailSent = true;
      console.log("Status update email sent to:", booking.email);

    } catch (emailError) {
      console.error("Status email failed:", emailError.message);
    }

    res.json({
      message: "Booking status updated successfully",
      booking,
      emailSent
    });

  } catch (error) {
    console.error("Status update error:", error.message);
    res.status(500).json({
      message: "Unable to update booking status"
    });
  }
});



const PORT = 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected successfully!");

    app.listen(PORT, () => {
      console.log(`Queue Less backend running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
  });
