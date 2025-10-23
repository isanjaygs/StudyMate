import os
import json
import io
import PyPDF2
import google.generativeai as genai
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables from .env file
load_dotenv()

# --- Initializations ---
app = Flask(__name__)
CORS(app)

# Configure the Gemini API key
try:
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    model = genai.GenerativeModel('gemini-2.5-flash')
except Exception as e:
    print(f"Error configuring Gemini API: {e}")
    model = None


# --- Helper Function ---
def clean_json_response(response_text):
    json_start = response_text.find('{')
    json_end = response_text.rfind('}')
    if json_start != -1 and json_end != -1:
        json_string = response_text[json_start:json_end + 1]
        try:
            json.loads(json_string)
            return json_string
        except json.JSONDecodeError:
            return response_text
    return response_text


def extract_text_from_pdf(file):
    """Extracts text from a PDF file stream."""
    text = ""
    try:
        file_stream = io.BytesIO(file.read())
        pdf_reader = PyPDF2.PdfReader(file_stream)
        for page in pdf_reader.pages:
            text += page.extract_text() or ""
    except Exception as e:
        print(f"Error reading PDF with PyPDF2: {e}")
    return text


# --- API Endpoints ---
@app.route('/')
def index():
    return "Quiz Generator Backend is running!"


@app.route('/parse-syllabus', methods=['POST'])
def parse_syllabus():
    if not model: return jsonify({"error": "Gemini model not configured"}), 500
    if 'syllabus' not in request.files: return jsonify({"error": "No file part"}), 400
    file = request.files['syllabus']
    if file.filename == '': return jsonify({"error": "No selected file"}), 400
    try:
        text = extract_text_from_pdf(file)
        if not text.strip(): return jsonify({"error": "Could not extract text from PDF."}), 400
        prompt = f"""Analyze the following syllabus text and extract the main, distinct topics. Return a JSON object with a single key "topics" which is a list of these topic strings. Example: {{"topics": ["Photosynthesis", "Cellular Respiration", "Mitosis"]}} Syllabus Text: --- {text} ---"""
        response = model.generate_content(prompt)
        cleaned_response = clean_json_response(response.text)
        topics_json = json.loads(cleaned_response)
        return jsonify(topics_json), 200
    except Exception as e:
        print(f"An error occurred during syllabus parsing: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/generate-quiz', methods=['POST'])
def generate_quiz():
    if not model: return jsonify({"error": "Gemini model is not configured. Check API key."}), 500
    try:
        data = request.get_json()
        topic = data.get('topic')
        num_questions = data.get('num_questions', 5)
        difficulty = data.get('difficulty', 'medium')
        full_syllabus_topics = data.get('full_syllabus_topics', [])
        if not topic and not full_syllabus_topics: return jsonify(
            {"error": "Topic or full syllabus topics are required."}), 400
        topic_prompt = f"the following topics: {', '.join(full_syllabus_topics)}" if full_syllabus_topics else f"the topic of '{topic}'"
        prompt = f"""Generate a JSON object for a quiz based on {topic_prompt}. Number of Questions: {num_questions}. Difficulty: "{difficulty}". The JSON object must follow this exact structure: {{"quiz": [{{"id": 1, "question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": "..."}}]}}. Ensure the 'correctAnswer' value is one of the strings from the 'options' array. Do not include any text or explanations outside of the JSON object."""
        response = model.generate_content(prompt)
        cleaned_response = clean_json_response(response.text)
        quiz_json = json.loads(cleaned_response)
        return jsonify(quiz_json), 200
    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500


@app.route('/generate-report-summary', methods=['POST'])
def generate_report_summary():
    if not model: return jsonify({"error": "Gemini model not configured"}), 500
    try:
        data = request.get_json()
        results = data.get('results')
        topic = data.get('topic')
        results_text = ""
        correct_count = sum(1 for item in results if item['isCorrect'])
        total_count = len(results)
        for item in results:
            results_text += f"- Question: {item['question']}\\n  - Your Answer: {item['userAnswer']}\\n  - Correct: {item['isCorrect']}\\n"
        prompt = f"""A student took a quiz on '{topic}' scoring {correct_count}/{total_count}. Results: {results_text}. Write a concise, encouraging 3-4 line summary. Identify strengths and areas for improvement. Return JSON: {{"summary": "Your summary here..."}}"""
        response = model.generate_content(prompt)
        cleaned_response = clean_json_response(response.text)
        summary_json = json.loads(cleaned_response)
        return jsonify(summary_json), 200
    except Exception as e:
        print(f"An error occurred during summary generation: {e}")
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500


@app.route('/get-video-suggestions', methods=['POST'])
def get_video_suggestions():
    if not model: return jsonify({"error": "Gemini model not configured"}), 500
    try:
        data = request.get_json()
        topic = data.get('topic')
        if not topic: return jsonify({"error": "Topic is required"}), 400
        prompt = f"""Generate a JSON object with 3 effective YouTube search queries for a student struggling with "{topic}". JSON structure: {{"suggestions": ["Query 1", "Query 2", "Query 3"]}}"""
        response = model.generate_content(prompt)
        cleaned_response = clean_json_response(response.text)
        suggestions_json = json.loads(cleaned_response)
        return jsonify(suggestions_json), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/process-notes', methods=['POST'])
def process_notes():
    if not model: return jsonify({"error": "Gemini model not configured"}), 500
    if 'notes' not in request.files: return jsonify({"error": "No notes file provided"}), 400
    file = request.files['notes']
    action = request.form.get('action', 'summarize')
    try:
        notes_text = extract_text_from_pdf(file)
        if not notes_text.strip(): return jsonify({"error": "Could not extract text from the provided notes PDF."}), 400

        if action == 'summarize':
            instruction = "Summarize the following text into clear, concise key points. Focus on the main ideas and important details."
        elif action == 'expand':
            instruction = "Expand on the following text. Elaborate on the key points, explain any abbreviations or jargon, and provide more detailed explanations to make the content easier to understand. The goal is to make the notes comprehensive for someone new to the topic."
        else:
            return jsonify({"error": "Invalid action specified."}), 400

        prompt = f"""Instruction: {instruction}. Text to process: --- {notes_text} --- Return a JSON object with a single key "processed_text" containing the result."""
        response = model.generate_content(prompt)
        cleaned_response = clean_json_response(response.text)
        processed_json = json.loads(cleaned_response)
        return jsonify(processed_json), 200
    except Exception as e:
        print(f"An error occurred during note processing: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/generate-study-plan', methods=['POST'])
def generate_study_plan():
    if not model: return jsonify({"error": "Gemini model not configured"}), 500
    if 'syllabus' not in request.files: return jsonify({"error": "No syllabus file provided"}), 400
    exam_date_str = request.form.get('exam_date')
    if not exam_date_str: return jsonify({"error": "Exam date not provided"}), 400
    file = request.files['syllabus']
    try:
        syllabus_text = extract_text_from_pdf(file)
        if not syllabus_text.strip(): return jsonify({"error": "Could not extract text from syllabus PDF."}), 400
        current_date_str = datetime.now().strftime('%Y-%m-%d')
        prompt = f"""Act as an expert academic planner. Create a detailed, day-by-day study plan. Current Date: {current_date_str}. Exam Date: {exam_date_str}. Syllabus Topics: --- {syllabus_text} --- Instructions: 1. Analyze days available. 2. Distribute topics logically. 3. Allocate revision days. 4. Include buffer/rest days. 5. Output a well-structured plan. 6. Return a JSON object with a single key "plan_text" containing the full study plan as a string."""
        response = model.generate_content(prompt)
        cleaned_response = clean_json_response(response.text)
        plan_json = json.loads(cleaned_response)
        return jsonify(plan_json), 200
    except Exception as e:
        print(f"An error occurred during plan generation: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/get-material-suggestions', methods=['POST'])
def get_material_suggestions():
    if not model:
        return jsonify({"error": "Gemini model not configured"}), 500

    syllabus_text = ""
    if 'syllabus_file' in request.files:
        file = request.files['syllabus_file']
        if file.filename != '':
            syllabus_text = extract_text_from_pdf(file)
    elif 'syllabus_text' in request.form:
        syllabus_text = request.form['syllabus_text']

    if not syllabus_text.strip():
        return jsonify({"error": "Syllabus content not provided or could not be read."}), 400

    try:
        prompt = f"""
        Based on the following syllabus, suggest 3 to 5 relevant and high-quality study materials like textbooks, online courses, or authoritative websites. For each suggestion, provide a title, a short description, and a direct link.

        Syllabus:
        ---
        {syllabus_text}
        ---

        Return a JSON object with a single key "materials" which is a list of objects.
        Each object in the list must have these three keys: "title", "description", and "link". Ensure links are valid URLs.
        Example format: {{"materials": [{{"title": "Campbell Biology", "description": "A comprehensive textbook covering all major topics in biology.", "link": "https://www.amazon.com/Campbell-Biology-12th-Lisa-Urry/dp/0135188741"}}]}}
        """
        response = model.generate_content(prompt)
        cleaned_response = clean_json_response(response.text)
        materials_json = json.loads(cleaned_response)
        return jsonify(materials_json), 200

    except Exception as e:
        print(f"An error occurred during material suggestion: {e}")
        return jsonify({"error": "Failed to generate suggestions. The AI might be unavailable."}), 500


@app.route('/chat', methods=['POST'])
def chat():
    if not model:
        return jsonify({"error": "Gemini model not configured"}), 500
    try:
        data = request.get_json()
        user_message = data.get('message')
        history = data.get('history', [])
        performance = data.get('performance', [])

        if not user_message:
            return jsonify({"error": "No message provided"}), 400

        performance_summary = "No quiz data available yet."
        if performance:
            performance_summary = "Here is the student's recent quiz performance:\n"
            for p in performance[-3:]:
                performance_summary += f"- On the topic '{p.get('topic')}', they scored {p.get('score')}.\n"

        history_formatted = "\n".join(
            [f"{'Student' if msg.get('role') == 'user' else 'Coach'}: {msg.get('text')}" for msg in history[-6:]])

        system_instruction = f"""
        You are a friendly, encouraging, and knowledgeable AI Study Coach. Your goal is to help a student succeed.
        Keep your responses concise and conversational (2-4 sentences). Do not use markdown formatting.

        **Student Context:**
        {performance_summary}

        **Conversation History:**
        {history_formatted}

        Now, respond to the student's latest message.
        Student: {user_message}
        Coach:
        """

        response = model.generate_content(system_instruction)
        bot_response_text = response.text.strip()

        return jsonify({"response": bot_response_text}), 200

    except Exception as e:
        print(f"An error occurred during chat: {e}")
        return jsonify({"error": "An error occurred in the chat service."}), 500


if __name__ == '__main__':
    app.run(debug=True)

