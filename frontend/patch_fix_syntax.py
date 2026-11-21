import re

with open('src/pages/admin/TrackerDetail.jsx', 'r') as f:
    content = f.read()

bad_string = """                        className="bg-dark hover:bg-dark-hover text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                      >
                        Bulk Add
                      </button>
                    </div>
                  </td>
                </tr>"""

good_string = """                        className="bg-dark hover:bg-dark-hover text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                      >
                        Bulk Add
                      </button>
                    </div>
                  </>
                  </td>
                </tr>"""

content = content.replace(bad_string, good_string)

with open('src/pages/admin/TrackerDetail.jsx', 'w') as f:
    f.write(content)
