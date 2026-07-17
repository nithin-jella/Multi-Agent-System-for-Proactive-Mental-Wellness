import re
from html.parser import HTMLParser
from html import unescape

def extract_text_from_html(html_content):
    """
    Extract clean text from HTML content, removing all tags and styling.
    
    Args:
        html_content (str): HTML string to extract text from
        
    Returns:
        str: Clean text content with proper spacing and line breaks
    """
    
    class HTMLTextExtractor(HTMLParser):
        def __init__(self):
            super().__init__()
            self.text_parts = []
            self.block_elements = {
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 
                'article', 'section', 'header', 'footer', 'main',
                'blockquote', 'pre', 'ul', 'ol', 'li', 'dl', 'dt', 'dd'
            }
            self.current_tag = None
            
        def handle_starttag(self, tag, attrs):
            self.current_tag = tag.lower()
            # Add line break before block elements
            if tag.lower() in self.block_elements:
                if self.text_parts and not self.text_parts[-1].endswith('\n'):
                    self.text_parts.append('\n')
                    
        def handle_endtag(self, tag):
            # Add line break after block elements
            if tag.lower() in self.block_elements:
                if self.text_parts and not self.text_parts[-1].endswith('\n'):
                    self.text_parts.append('\n')
            self.current_tag = None
            
        def handle_data(self, data):
            # Clean and add text data
            cleaned_data = data.strip()
            if cleaned_data:
                # Add space if needed to separate words
                if (self.text_parts and 
                    not self.text_parts[-1].endswith((' ', '\n')) and 
                    not cleaned_data.startswith(' ')):
                    self.text_parts.append(' ')
                self.text_parts.append(cleaned_data)
                
        def get_text(self):
            # Join all text parts
            text = ''.join(self.text_parts)
            
            # Clean up the text
            text = re.sub(r'\s+', ' ', text)  # Replace multiple spaces with single space
            text = re.sub(r'\n\s*\n', '\n\n', text)  # Replace multiple newlines with double newline
            text = text.strip()
            
            return text
    
    if not html_content or not html_content.strip():
        return ""
    
    try:
        # Decode HTML entities first
        html_content = unescape(html_content)
        
        # Create parser and extract text
        parser = HTMLTextExtractor()
        parser.feed(html_content)
        extracted_text = parser.get_text()
        
        return extracted_text
        
    except Exception as e:
        # Fallback: use regex to strip tags if parser fails
        return fallback_text_extraction(html_content)


def fallback_text_extraction(html_content):
    """
    Fallback method using regex to extract text if HTML parser fails.
    
    Args:
        html_content (str): HTML string to extract text from
        
    Returns:
        str: Clean text content
    """
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', html_content)
    
    # Decode HTML entities
    text = unescape(text)
    
    # Clean up whitespace
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()
    
    return text


# Example usage and test function
def test_extractor():
    """Test the HTML text extractor with the provided examples."""
    
    # Test case 1: H1 tag
    h1_html = """<h1 style='line-height:16.45pt'><a name="_TOC_250009"></a><span lang=id style='color:#231F20;letter-spacing:-.1pt'>SAMBUTAN</span></h1>"""
    
    # Test case 2: Complex P tag
    p_html = """<p class=MsoBodyText style='margin-top:0in;margin-right:22.4pt;margin-bottom:0in;margin-left:18.65pt;margin-bottom:.0001pt;text-align:justify;text-indent:23.85pt;line-height:100%'><span lang=id style='color:#231F20;letter-spacing:-.1pt'>Puji</span><span lang=id style='color:#231F20;letter-spacing:-.6pt'> </span><span lang=id style='color:#231F20;letter-spacing:-.1pt'>syukur</span><span lang=id style='color:#231F20;letter-spacing:-.6pt'> </span><span lang=id style='color:#231F20;letter-spacing:-.1pt'>ke</span><span lang=id style='color:#231F20;letter-spacing:-.6pt'> </span><span lang=id style='color:#231F20;letter-spacing:-.1pt'>hadirat</span><span lang=id style='color:#231F20;letter-spacing:-.75pt'> </span><span lang=id style='color:#231F20;letter-spacing:-.1pt'>Tuhan</span><span lang=id style='color:#231F20;letter-spacing:-.75pt'> </span><span lang=id style='color:#231F20;letter-spacing:-.1pt'>Yang</span><span lang=id style='color:#231F20;letter-spacing:-.55pt'> </span><span lang=id style='color:#231F20;letter-spacing:-.1pt'>Maha</span><span lang=id style='color:#231F20;letter-spacing:-.6pt'> </span><span lang=id style='color:#231F20;letter-spacing:-.1pt'>Kuasa,</span><span lang=id style='color:#231F20;letter-spacing:-.6pt'> </span><span lang=id style='color:#231F20;letter-spacing:-.1pt'>yang</span><span lang=id style='color:#231F20;letter-spacing:-.6pt'> </span><span lang=id style='color:#231F20;letter-spacing:-.1pt'>telah </span><span lang=id style='color:#231F20'>memberikan<span style='letter-spacing:-.2pt'> </span>rahmat<span style='letter-spacing:-.2pt'> </span>dan<span style='letter-spacing:-.2pt'> </span>karunia-Nya<span style='letter-spacing:-.2pt'> </span>sehingga<span style='letter-spacing:-.2pt'> </span>Buku<span style='letter-spacing:-.2pt'> </span>Petunjuk Teknis Pencegahan dan Pengendalian Gangguan Mental Emosional dapat diselesaikan.</span></p>"""
    
    # Combined HTML
    combined_html = h1_html + "\n" + p_html
    
    print("=== HTML Text Extractor Test ===\n")
    
    print("1. H1 Tag Extraction:")
    print("Input:", h1_html[:100] + "...")
    print("Output:", extract_text_from_html(h1_html))
    print()
    
    print("2. P Tag Extraction:")
    print("Input:", p_html[:100] + "...")
    print("Output:", extract_text_from_html(p_html))
    print()
    
    print("3. Combined Extraction:")
    print("Output:", extract_text_from_html(combined_html))
    print()
    
    # Additional test cases
    test_cases = [
        "<div><p>Hello <b>world</b>!</p><p>Another paragraph.</p></div>",
        "<span>Simple</span> <span>text</span> <span>extraction</span>",
        "<h2>Title</h2><p>Content with <em>emphasis</em> and <strong>strong</strong> text.</p>",
        ""  # Empty string test
    ]
    
    print("4. Additional Test Cases:")
    for i, test_html in enumerate(test_cases, 1):
        result = extract_text_from_html(test_html)
        print(f"Test {i}: '{test_html[:50]}...' -> '{result}'")


if __name__ == "__main__":
    test_extractor()